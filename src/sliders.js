// 侧栏滑块：Cairo 自绘 SliderBar + 音量 / 麦克风 / 亮度三路控制。
// 颜色全部取自系统主题：强调色经隐藏 probe 读出，前景色取主题节点；无硬编码颜色。
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gvc from 'gi://Gvc';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
    volumeLimit,
    volumeRatio,
    volumeIconName,
    micIconName,
    sliderDisplay,
    ratioFromFraction,
    setStreamVolume,
    watchDefaultStream,
} from './audio-stream.js';

const BAR_H = 6;
const RADIUS = 3;
const THUMB_R = 7;

// Clutter.Color 为 0–255，Cogl.Color 为 0–1；归一化到 Cairo 需要的 0–1
function toRGBA(c, alpha) {
    const scale = c.red > 1 || c.green > 1 || c.blue > 1 ? 255 : 1;
    const a = alpha ?? (c.alpha > 1 ? c.alpha / 255 : c.alpha);
    return [c.red / scale, c.green / scale, c.blue / scale, a];
}

export class SliderBar {
    constructor({ onChange } = {}) {
        this._value = 0;
        this._dragging = false;
        this._onChange = onChange ?? (() => {});
        this._signals = [];
        this.actor = this._build();
    }

    setValue(v) {
        this._value = Math.max(0, Math.min(1, v));
        this.actor.queue_repaint();
    }

    destroy() {
        for (const [obj, id] of this._signals) {
            try { obj.disconnect(id); } catch (e) { /* actor 已销毁时忽略 */ }
        }
        this._signals = [];
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }

    _connect(obj, signal, handler) {
        this._signals.push([obj, obj.connect(signal, handler)]);
    }

    _build() {
        const canvas = new St.DrawingArea({
            x_expand: true,
            reactive: true,
            style_class: 'ns-slider-track',
        });
        // 隐藏 probe：把系统强调色挂在标准 background-color 上，绘制时从主题节点读出解析后的颜色
        this._accentProbe = new St.Widget({
            style_class: 'ns-slider-accent',
            width: 0, height: 0,
        });
        canvas.add_child(this._accentProbe);
        this._connect(canvas, 'repaint', area => this._onRepaint(area));
        this._connect(canvas, 'button-press-event', (_a, event) => this._onPress(event));
        this._connect(canvas, 'motion-event', (_a, event) => this._onMotion(event));
        this._connect(canvas, 'button-release-event', () => {
            this._dragging = false;
            return Clutter.EVENT_STOP;
        });
        return canvas;
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        const barY = (h - BAR_H) / 2;

        const rrect = (x, y, rw, rh) => {
            const rc = Math.min(RADIUS, rw / 2, rh / 2);
            cr.newPath();
            cr.arc(x + rc, y + rc, rc, Math.PI, 1.5 * Math.PI);
            cr.arc(x + rw - rc, y + rc, rc, 1.5 * Math.PI, 2 * Math.PI);
            cr.arc(x + rw - rc, y + rh - rc, rc, 0, 0.5 * Math.PI);
            cr.arc(x + rc, y + rh - rc, rc, 0.5 * Math.PI, Math.PI);
            cr.closePath();
        };

        const fg = area.get_theme_node().get_foreground_color();
        let accent = fg;
        try { accent = this._accentProbe.get_theme_node().get_background_color(); } catch (e) { /* 用前景兜底 */ }

        cr.setSourceRGBA(...toRGBA(fg, 0.22));
        rrect(0, barY, w, BAR_H);
        cr.fill();

        const fillW = w * this._value;
        if (fillW > 0) {
            cr.setSourceRGBA(...toRGBA(accent));
            rrect(0, barY, fillW, BAR_H);
            cr.fill();
        }

        const thumbX = Math.max(THUMB_R, Math.min(w - THUMB_R, fillW));
        cr.arc(thumbX, h / 2, THUMB_R, 0, 2 * Math.PI);
        cr.setSourceRGBA(...toRGBA(fg, 1));
        cr.fill();

        cr.$dispose();
    }

    _valueFromEvent(event) {
        const [evX] = event.get_coords();
        const [trackW] = this.actor.get_transformed_size();
        const [trackX] = this.actor.get_transformed_position();
        return Math.max(0, Math.min(1, (evX - trackX) / trackW));
    }

    _onPress(event) {
        this._dragging = true;
        const val = this._valueFromEvent(event);
        this.setValue(val);
        this._onChange(val);
        return Clutter.EVENT_STOP;
    }

    _onMotion(event) {
        if (!this._dragging) return Clutter.EVENT_PROPAGATE;
        const val = this._valueFromEvent(event);
        this.setValue(val);
        this._onChange(val);
        return Clutter.EVENT_STOP;
    }
}

// 一格滑块：图标 + 标题 + 百分比 + SliderBar；标题与百分比由各行 refresh 更新
class SliderRow {
    constructor({ iconName, title }) {
        this._signals = [];
        this._slider = new SliderBar({ onChange: v => this._onChange(v) });
        this.actor = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            style_class: 'ns-slider-section',
        });
        const header = new St.BoxLayout({ style_class: 'ns-slider-header', x_expand: true });
        this._icon = new St.Icon({ icon_name: iconName, icon_size: 16, style_class: 'ns-slider-icon' });
        header.add_child(this._icon);
        header.add_child(new St.Label({ text: title, x_expand: true, style_class: 'ns-slider-label' }));
        this._perc = new St.Label({ text: '—', style_class: 'ns-slider-perc' });
        header.add_child(this._perc);
        this.actor.add_child(header);
        this.actor.add_child(this._slider.actor);
    }

    // v 是相对 100% 的音量比；limit 是当前系统上限。滑块位置按 limit 归一化，
    // 百分比标签仍显示真实音量，所以允许放大时可以看到 100% 以上。
    setValue(v, muted = false, limit = 1, iconRatio = v) {
        const { fraction, percent } = sliderDisplay(v, limit);
        this._slider.setValue(fraction);
        this._perc.text = `${percent}%`;
        this._updateIcon(iconRatio, muted);
    }

    setUnavailable() {
        this._perc.text = 'N/A';
    }

    destroy() {
        // 先断开外部对象（如 MixerControl）上的信号，再销毁本行持有的 actor
        for (const [obj, id] of this._signals ?? []) {
            try { obj.disconnect(id); } catch (e) { /* 忽略已销毁对象 */ }
        }
        this._signals = [];
        if (this._slider) {
            this._slider.destroy();
            this._slider = null;
        }
        // header 里的图标/标签/百分比随 actor 连带销毁，这里显式 destroy 并置空引用
        if (this._icon) {
            this._icon.destroy();
            this._icon = null;
        }
        if (this._perc) {
            this._perc.destroy();
            this._perc = null;
        }
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }

    _connect(obj, signal, handler) {
        this._signals.push([obj, obj.connect(signal, handler)]);
    }

    _onChange(/* v */) {}

    _updateIcon(/* v, muted */) {}
}

class VolumeRow extends SliderRow {
    constructor(mixer, soundSettings) {
        super({ iconName: 'audio-volume-medium-symbolic', title: '音量' });
        this._mixer = mixer;
        this._soundSettings = soundSettings;
        this._limit = 1;
        this._updateLimit();
        this._watch = watchDefaultStream(
            mixer,
            'default-sink-changed',
            () => mixer.get_state() === Gvc.MixerControlState.READY
                ? mixer.get_default_sink() : null,
            () => this.refresh()
        );
        this._connect(soundSettings, 'changed::allow-volume-above-100-percent', () => {
            this._updateLimit();
            this.refresh();
        });
        this._connect(mixer, 'state-changed', () => {
            this._updateLimit();
            this._watch.sync();
        });
    }

    destroy() {
        this._watch.dispose();
        super.destroy();
    }

    // 与 gsd-media-keys / GNOME Shell 一样读同一个 GSettings key，取 GVC 的放大上限
    _updateLimit() {
        this._limit = volumeLimit(
            this._mixer.get_vol_max_norm(),
            this._mixer.get_vol_max_amplified(),
            this._soundSettings.get_boolean('allow-volume-above-100-percent')
        );
    }

    refresh() {
        if (!this._mixer || this._mixer.get_state() !== Gvc.MixerControlState.READY ||
            !this._mixer.get_default_sink()) {
            this.setUnavailable();
            return;
        }
        const sink = this._mixer.get_default_sink();
        const maxNorm = this._mixer.get_vol_max_norm();
        const ratio = volumeRatio(sink, maxNorm, this._limit);
        // 图标按未裁剪的真实音量选，和系统菜单一样能反映残留的 >100% 音量
        this.setValue(ratio, sink.is_muted, this._limit, sink.volume / maxNorm);
    }

    _onChange(v) {
        const sink = this._mixer?.get_default_sink();
        if (!sink || this._mixer.get_state() !== Gvc.MixerControlState.READY) return;
        const ratio = ratioFromFraction(v, this._limit);
        setStreamVolume(sink, this._mixer.get_vol_max_norm(), ratio);
        // 不在这里本地改 UI：流音量变化通知会回调 refresh()，以 PA 回读值为准
    }

    _updateIcon(ratio, muted) {
        this._icon.icon_name = volumeIconName(ratio, muted);
    }
}

class MicRow extends SliderRow {
    constructor(mixer, soundSettings) {
        super({ iconName: 'audio-input-microphone-symbolic', title: '麦克风' });
        this._mixer = mixer;
        this._soundSettings = soundSettings;
        this._limit = 1;
        this._updateLimit();
        this._watch = watchDefaultStream(
            mixer,
            'default-source-changed',
            () => mixer.get_state() === Gvc.MixerControlState.READY
                ? mixer.get_default_source() : null,
            () => this.refresh()
        );
        this._connect(soundSettings, 'changed::allow-volume-above-100-percent', () => {
            this._updateLimit();
            this.refresh();
        });
        this._connect(mixer, 'state-changed', () => {
            this._updateLimit();
            this._watch.sync();
        });
    }

    destroy() {
        this._watch.dispose();
        super.destroy();
    }

    _updateLimit() {
        this._limit = volumeLimit(
            this._mixer.get_vol_max_norm(),
            this._mixer.get_vol_max_amplified(),
            this._soundSettings.get_boolean('allow-volume-above-100-percent')
        );
    }

    refresh() {
        if (!this._mixer || this._mixer.get_state() !== Gvc.MixerControlState.READY ||
            !this._mixer.get_default_source()) {
            this.setUnavailable();
            return;
        }
        const src = this._mixer.get_default_source();
        const maxNorm = this._mixer.get_vol_max_norm();
        const ratio = volumeRatio(src, maxNorm, this._limit);
        this.setValue(ratio, src.is_muted, this._limit, src.volume / maxNorm);
    }

    _onChange(v) {
        const src = this._mixer?.get_default_source();
        if (!src || this._mixer.get_state() !== Gvc.MixerControlState.READY) return;
        // 麦克风在非 0 处调整时保留用户设置的静音，只有从 0 拉起才解除
        const ratio = ratioFromFraction(v, this._limit);
        setStreamVolume(src, this._mixer.get_vol_max_norm(), ratio,
            { unmute: false, unmuteFromZero: true });
    }

    _updateIcon(ratio, muted) {
        this._icon.icon_name = micIconName(ratio, muted);
    }
}

class BrightnessRow extends SliderRow {
    constructor() {
        super({ iconName: 'display-brightness-symbolic', title: '亮度' });
        this._available = this.isAvailable();
        if (!this._available) {
            this.setUnavailable();
            return;
        }
        const scale = Main.brightnessManager.globalScale;
        if (scale && scale.connect) this._connect(scale, 'notify::value', () => this.refresh());
        this.refresh();
    }

    // 无背光设备（如台式机 / 嵌套会话）没有 brightnessManager，优雅降级
    static isAvailable() {
        return !!Main.brightnessManager;
    }

    isAvailable() {
        return BrightnessRow.isAvailable();
    }

    refresh() {
        if (!this._available) {
            this.setUnavailable();
            return;
        }
        const scale = Main.brightnessManager?.globalScale;
        if (scale === undefined || scale === null) {
            this.setUnavailable();
            return;
        }
        const val = scale.value !== undefined ? scale.value : scale;
        this.setValue(val);
    }

    _onChange(v) {
        if (!this._available) return;
        const scale = Main.brightnessManager?.globalScale;
        if (scale === undefined || scale === null) return;
        if (scale.value !== undefined) scale.value = v;
        else Main.brightnessManager.globalScale = v;
        this.setValue(v);
    }
}

export class QuickSliders {
    constructor() {
        this.actor = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            style_class: 'ns-slider-group',
        });
        this._mixer = new Gvc.MixerControl({ name: 'NextSidebar' });
        this._mixer.open();
        // 与媒体键 / GNOME Shell 共用同一个 key，决定音量上限是否为 150%
        this._soundSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.sound' });
        this._rows = [
            new VolumeRow(this._mixer, this._soundSettings),
            new MicRow(this._mixer, this._soundSettings),
            new BrightnessRow(),
        ];
        for (const row of this._rows) this.actor.add_child(row.actor);
    }

    destroy() {
        for (const row of this._rows ?? []) row.destroy();
        this._rows = [];
        if (this._mixer) {
            this._mixer.close();
            this._mixer = null;
        }
        this._soundSettings = null;
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }
}
