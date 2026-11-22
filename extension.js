// NextSidebar 侧边栏扩展：时钟 / 天气 / 月历与音量、麦克风、亮度，样式沿用 NextKde macOS 玻璃风格
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { categoryFromXiaomi } from './src/weather-theme.js';
import { buildMonthGrid } from './src/calendar-grid.js';
import { FlipClock } from './src/flip-clock.js';
import { fetchForecast } from './src/weather-service.js';
import { iconForCategory } from './src/weather-icons.js';
import { stylesheetFile } from './src/extension-paths.js';
import { Sidebar } from './src/sidebar.js';
import { QuickSliders } from './src/sliders.js';
import { presetCity } from './src/cities.js';
import { addCustomCity } from './src/custom-cities.js';
import { timezoneForCity, dateTimeParts } from './src/timezone.js';

const CARD_HEIGHT = 300;
// 时钟卡片单独用紧凑高度：卡片宽 328px 减 padding 32px = 296px 内部，时钟宽 270px，
// 左右各余 13px（到卡片边缘 29px）；时钟高 84px，取同样留白 → 84 + 2×29 = 142px。
// 这样时钟四边间距一致，天气/日历卡仍用默认 300px。
const CLOCK_CARD_HEIGHT = 142;
const WEATHER_INTERVAL = 15 * 60; // 秒

const CATEGORY_LABEL = {
    clear: '晴', partlyCloudy: '多云', overcast: '阴',
    fog: '雾', haze: '霾', rain: '雨', snow: '雪',
    storm: '雷暴', hail: '冰雹',
};

function label(text, styleClass, props = {}) {
    return new St.Label({ text, style_class: styleClass, ...props });
}

function numberText(v) {
    return Number.isFinite(v) ? String(Math.round(v)) : '--';
}

export default class NextSidebarExtension extends Extension {
    enable() {
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._theme = this._themeContext.get_theme();
        // Extension.dir 是 Gio.File，必须用 get_child 解析，不能字符串拼接
        this._stylesheet = stylesheetFile(this.dir);
        this._theme.load_stylesheet(this._stylesheet);
        // GNOME 切换明暗主题会重建 StTheme 并丢弃外挂样式，changed 后重新加载
        this._themeChangedId = this._themeContext.connect('changed', () => this._reapplyStylesheet());

        this._settings = this.getSettings();
        this._settingIds = [];
        this._updateTimezone();

        // 侧栏容器：三卡与滑块都挂进侧栏的滚动内容区
        this._sidebar = new Sidebar();
        this._container = this._sidebar.content;

        // 卡片开关与城市变化需要重建；城市还要立即按新城市拉一次天气
        for (const key of ['show-clock', 'show-calendar', 'show-weather', 'city']) {
            this._settingIds.push(this._settings.connect(`changed::${key}`, () => {
                if (key === 'city') {
                    this._updateTimezone();
                    this._fetchWeather();
                }
                this._rebuild();
            }));
        }
        this._clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._tickClock();
            return GLib.SOURCE_CONTINUE;
        });
        this._weatherTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, WEATHER_INTERVAL, () => {
            this._fetchWeather();
            return GLib.SOURCE_CONTINUE;
        });

        this._rebuild();
        this._sliders = new QuickSliders();
        this._sidebar.content.add_child(this._sliders.actor);
        this._registerKeybinding();
        this._tickClock();
        this._fetchWeather();
    }

    disable() {
        Main.wm.removeKeybinding('toggle-sidebar');
        if (this._themeChangedId) {
            this._themeContext.disconnect(this._themeChangedId);
            this._themeChangedId = 0;
        }
        if (this._clockTimerId) {
            GLib.source_remove(this._clockTimerId);
            this._clockTimerId = 0;
        }
        if (this._weatherTimerId) {
            GLib.source_remove(this._weatherTimerId);
            this._weatherTimerId = 0;
        }
        for (const id of this._settingIds ?? []) {
            this._settings.disconnect(id);
        }
        this._settingIds = [];
        this._settings = null;
        if (this._stylesheet) {
            this._theme.unload_stylesheet(this._stylesheet);
            this._stylesheet = null;
        }
        if (this._sliders) {
            this._sliders.destroy();
            this._sliders = null;
        }
        if (this._sidebar) {
            this._sidebar.destroy();
            this._sidebar = null;
        }
        this._container = null;
        this._clearCardRefs();
    }

    /** 主题 changed 在明暗切换、字体、图标、缩放时都会触发，先卸载再加载保证幂等，避免重复累积。
     *  load/unload 自身也会同步触发 changed，所以重入时直接返回，否则无限递归会让 Shell 卡死。 */
    _reapplyStylesheet() {
        if (!this._stylesheet || this._reapplying) return;
        this._reapplying = true;
        try {
            this._theme?.unload_stylesheet(this._stylesheet);
            this._theme = this._themeContext.get_theme();
            this._theme.load_stylesheet(this._stylesheet);
        } finally {
            this._reapplying = false;
        }
    }

    _registerKeybinding() {
        Main.wm.addKeybinding('toggle-sidebar', this.getSettings(), Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, () => this._sidebar.toggle());
    }

    _clearCardRefs() {
        this._flipClock = null;
        this._calTitle = null;
        this._calGrid = null;
        this._weatherTemp = null;
        this._weatherCondition = null;
        this._weatherFeels = null;
        this._weatherRangeNight = null;
        this._weatherRangeDay = null;
        this._weatherIconBox = null;
        this._clockCard = null;
        this._calendarCard = null;
        this._weatherCard = null;
    }

    /** 城市决定时区；未保存过的城市先退回系统本地，搜到后由天气回调刷新。 */
    _updateTimezone() {
        const city = this._settings.get_string('city');
        this._timezone = timezoneForCity(city, this._settings.get_strv('custom-cities')) ??
            GLib.TimeZone.new_local();
    }

    _now() {
        return dateTimeParts(GLib.DateTime.new_now(this._timezone ?? GLib.TimeZone.new_local()));
    }

    _rebuild() {
        // 侧栏 content 是长期存在的容器，重建时先销毁其中的旧卡片再清空引用
        for (const card of [this._clockCard, this._weatherCard, this._calendarCard]) {
            if (card) card.destroy();
        }
        this._clearCardRefs();

        // 自上而下：时钟 → 天气 → 月历
        if (this._settings.get_boolean('show-clock'))
            this._buildClockCard();
        if (this._settings.get_boolean('show-weather'))
            this._buildWeatherCard();
        if (this._settings.get_boolean('show-calendar'))
            this._buildCalendarCard();

        // 重建后把滑块重新排回末尾，保证顺序始终是卡片在上、滑块在下
        if (this._sliders?.actor)
            this._container.set_child_above_sibling(this._sliders.actor, null);

        this._tickClock();
    }

    _card(height = CARD_HEIGHT) {
        return new St.BoxLayout({
            style_class: 'dw-card',
            orientation: Clutter.Orientation.VERTICAL,
            height,
            reactive: false,
            // 撑满侧栏内容区（去掉内边距后约 328px），三卡与滑块同宽
            x_expand: true,
            y_expand: false,
        });
    }

    _buildClockCard() {
        const card = this._card(CLOCK_CARD_HEIGHT);
        this._clockCard = card;
        // 翻页时钟是卡片里唯一元素，上下占位符使其在卡片内垂直居中
        card.add_child(new St.Widget({ y_expand: true }));

        this._flipClock = new FlipClock();
        card.add_child(this._flipClock.actor);
        card.add_child(new St.Widget({ y_expand: true }));

        this._container.add_child(card);
    }

    _buildCalendarCard() {
        const card = this._card();
        this._calendarCard = card;
        // 年月标题保持在卡片顶部、行内水平居中，不参与下方内容的垂直居中
        this._calTitle = label('', 'dw-cal-title', { x_align: Clutter.ActorAlign.CENTER });
        card.add_child(this._calTitle);

        // body 占满标题下方的剩余空间，内部用上下弹性空白把内容夹到垂直中央
        const calBody = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            y_expand: true,
        });
        calBody.add_child(new St.Widget({ y_expand: true }));

        const weekRow = new St.BoxLayout({
            style_class: 'dw-cal-weekrow',
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
            reactive: false,
        });
        for (const w of ['一', '二', '三', '四', '五', '六', '日']) {
            const cell = label(w, 'dw-cal-weekday', { width: 40 });
            // 与日期格子用相同的居中方式，保证星期列和日期列对齐
            cell.clutter_text.x_align = Clutter.ActorAlign.CENTER;
            cell.clutter_text.y_align = Clutter.ActorAlign.CENTER;
            weekRow.add_child(cell);
        }
        calBody.add_child(weekRow);

        this._calGrid = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_align: Clutter.ActorAlign.CENTER,
            reactive: false,
        });
        calBody.add_child(this._calGrid);

        calBody.add_child(new St.Widget({ y_expand: true }));
        card.add_child(calBody);
        this._container.add_child(card);
        this._tickCalendar();
    }

    _tickCalendar() {
        if (!this._calGrid || !this._calTitle) return;
        const { year, month, day } = this._now();
        this._calTitle.text = `${year} 年 ${month} 月`;
        const today = { year, month, day };
        const { cells } = buildMonthGrid(year, month, today);

        this._calGrid.destroy_all_children();
        for (let i = 0; i < cells.length; i += 7) {
            const row = new St.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL, reactive: false });
            for (let j = 0; j < 7; j++) {
                const c = cells[i + j];
                // 每格是竖向盒：公历数字在上，农历小字在下
                const cell = new St.BoxLayout({
                    orientation: Clutter.Orientation.VERTICAL,
                    width: 40,
                    height: 34,
                    reactive: false,
                });
                // 今天高亮落在整格容器上，公历与农历两行一起继承白字
                if (c.isToday) cell.style_class = 'dw-cal-today';

                const dayCls = !c.isCurrentMonth ? 'dw-cal-day-dim' : 'dw-cal-day';
                const dayLabel = label(String(c.day), dayCls, { width: 40 });
                // St 的 CSS 引擎不支持 opacity 属性，淡化必须设到 Clutter actor 的 opacity（0-255）。
                if (!c.isCurrentMonth) dayLabel.opacity = Math.round(0.30 * 255);
                // St.Label 自身的 x_align/y_align 只控制 actor 在父容器中的位置；
                // 日期要在背景块内居中，须用内部 Clutter.Text 的对齐属性
                dayLabel.clutter_text.x_align = Clutter.ActorAlign.CENTER;
                dayLabel.clutter_text.y_align = Clutter.ActorAlign.CENTER;
                cell.add_child(dayLabel);

                // 第二行小字优先级：节日 > 节气 > 农历日；样式与淡化规则不变
                const subLabel = c.holiday ?? c.solarTerm ?? c.lunar;
                const lunarCls = !c.isCurrentMonth ? 'dw-cal-lunar dw-cal-lunar-dim' : 'dw-cal-lunar';
                const lunarLabel = label(subLabel, lunarCls, { width: 40 });
                // 农历小字更小，淡化比公历浅一些（0.45），否则会看不清
                if (!c.isCurrentMonth) lunarLabel.opacity = Math.round(0.45 * 255);
                lunarLabel.clutter_text.x_align = Clutter.ActorAlign.CENTER;
                cell.add_child(lunarLabel);

                row.add_child(cell);
            }
            this._calGrid.add_child(row);
        }
    }

    _buildWeatherCard() {
        const card = this._card();
        this._weatherCard = card;
        card.style_class = 'dw-card dw-weather-card';

        // 底色与内边距统一由 .dw-card 提供，内容直接铺在卡片里
        const content = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            reactive: false,
            x_expand: true,
            y_expand: true,
        });
        content.add_child(new St.Widget({ y_expand: true }));

        // 顶部：彩色图标 + 当日天气状况
        const header = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
            reactive: false,
        });
        this._weatherIconBox = new St.Widget({
            style_class: 'dw-weather-icon',
            width: 56,
            height: 56,
            reactive: false,
        });
        header.add_child(this._weatherIconBox);
        this._weatherCondition = label('晴', 'dw-weather-condition');
        header.add_child(this._weatherCondition);
        content.add_child(header);

        // 当前温度 / 体感温度 / 晚间与白天高低温（同一行）
        const tempRow = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'dw-weather-temp-row',
        });
        this._weatherTemp = label('--', 'dw-weather-temp');
        // °C 用独立小号标签并顶部对齐，作为温度值右上方的上标
        this._weatherUnit = label('°C', 'dw-weather-unit', {
            y_align: Clutter.ActorAlign.START,
        });
        tempRow.add_child(this._weatherTemp);
        tempRow.add_child(this._weatherUnit);

        // 体感：体感 + 数字 + 上标 °C
        const feelsRow = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'dw-weather-feels-row',
        });
        feelsRow.add_child(label('体感温度', 'dw-weather-feels dw-weather-feels-prefix'));
        this._weatherFeels = label('--', 'dw-weather-feels');
        feelsRow.add_child(this._weatherFeels);
        feelsRow.add_child(label('°C', 'dw-weather-unit-small', {
            y_align: Clutter.ActorAlign.START,
        }));

        // 晚间 / 白天高低温：各带一个上标 °C，整行居中
        const rangeRow = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'dw-weather-range-row',
        });
        rangeRow.add_child(label('晚间：', 'dw-weather-range'));
        this._weatherRangeNight = label('--', 'dw-weather-range');
        rangeRow.add_child(this._weatherRangeNight);
        rangeRow.add_child(label('°C', 'dw-weather-unit-small', {
            y_align: Clutter.ActorAlign.START,
        }));
        rangeRow.add_child(label('・白天：', 'dw-weather-range dw-weather-range-sep'));
        this._weatherRangeDay = label('--', 'dw-weather-range');
        rangeRow.add_child(this._weatherRangeDay);
        rangeRow.add_child(label('°C', 'dw-weather-unit-small', {
            y_align: Clutter.ActorAlign.START,
        }));

        content.add_child(tempRow);
        content.add_child(feelsRow);
        content.add_child(rangeRow);
        content.add_child(new St.Widget({ y_expand: true }));

        card.add_child(content);
        this._container.add_child(card);
    }

    _setWeatherIcon(cat, isDay) {
        if (!this._weatherIconBox) return;
        this._weatherIconBox.destroy_all_children();
        const file = this.dir.get_child('icons').get_child(iconForCategory(cat, isDay));
        if (!file.query_exists(null)) return;
        const scale = this._themeContext?.scale_factor ?? 1;
        // load_file_async 返回的是 Clutter.Actor，不是 St.Widget：
        // 不能调用 set_style_class_name 等 St 专有方法，否则会在 add_child 前抛异常。
        const texture = St.TextureCache.get_default().load_file_async(file, 56, 56, scale, scale);
        this._weatherIconBox.add_child(texture);
    }

    _fetchWeather() {
        const city = this._settings.get_string('city');
        fetchForecast(data => {
            if (!data) return;

            // 自定义城市：用小米返回的偏移刷新时区，并保存进城市表供设置窗口与下次使用
            if (!presetCity(city) && Number.isFinite(data.timeZoneShift)) {
                const saved = this._settings.get_strv('custom-cities');
                const next = addCustomCity(saved, {
                    name: city,
                    timeZoneShift: data.timeZoneShift,
                    affiliation: data.affiliation ?? '',
                });
                if (JSON.stringify(next) !== JSON.stringify(saved)) {
                    this._settings.set_strv('custom-cities', next);
                    this._updateTimezone();
                    this._tickClock();
                }
            }

            // 天气解析失败时只有时区信息，保留上一次显示的温度
            if (typeof data.code !== 'string' || !this._weatherTemp) return;
            const cat = categoryFromXiaomi(data.code);

            this._weatherCondition.text = CATEGORY_LABEL[cat] ?? '阴';
            this._weatherTemp.text = numberText(data.temperature);
            this._weatherFeels.text = numberText(data.apparent);
            this._weatherRangeNight.text = numberText(data.dayLow);
            this._weatherRangeDay.text = numberText(data.dayHigh);

            this._setWeatherIcon(cat, data.isDay);
        }, city);
    }

    _tickClock() {
        // 翻页时钟按选中城市的时区走，只传时和分；每秒 tick 内完成翻页动画
        const { hour, minute } = this._now();
        this._flipClock?.update(hour, minute);
        this._tickCalendar();
    }
}
