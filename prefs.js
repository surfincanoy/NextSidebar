// 扩展设置窗口：城市（预设 + 手输保存的自定义城市）。
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { PRESET_CITIES } from './src/cities.js';
import { parseCustomCities } from './src/custom-cities.js';

export default class NextSidebarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // 让信号回调里的 settings 活着，直到设置窗口关闭
        window._settings = settings;

        const page = new Adw.PreferencesPage();
        window.add(page);
        window.set_default_size(440, 520);

        this._addCityRows(page, settings);
    }

    _addCityRows(page, settings) {
        const group = new Adw.PreferencesGroup({
            title: _('城市'),
            description: _('城市同时决定天气与时钟时区'),
        });
        page.add(group);

        const entry = new Adw.EntryRow({ title: _('城市名称') });
        settings.bind('city', entry, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(entry);

        const combo = new Adw.ComboRow({ title: _('快捷选择') });
        group.add(combo);
        const names = [];
        // 换 model 会短暂把选中项重置到第一项，期间不能回写 city 覆盖手输内容
        let updatingModel = false;
        const refreshSelection = () => {
            const index = names.indexOf(settings.get_string('city'));
            combo.selected = index >= 0 ? index : Gtk.INVALID_LIST_POSITION;
        };
        const refreshModel = () => {
            updatingModel = true;
            names.length = 0;
            const labels = [];
            for (const city of PRESET_CITIES) {
                names.push(city.name);
                labels.push(city.name);
            }
            for (const city of parseCustomCities(settings.get_strv('custom-cities'))) {
                names.push(city.name);
                labels.push(city.affiliation ? `${city.name} · ${city.affiliation}` : city.name);
            }
            combo.model = Gtk.StringList.new(labels);
            refreshSelection();
            updatingModel = false;
        };
        refreshModel();
        settings.connect('changed::custom-cities', refreshModel);
        settings.connect('changed::city', refreshSelection);
        combo.connect('notify::selected', () => {
            if (updatingModel) return;
            const name = names[combo.selected];
            if (name)
                settings.set_string('city', name);
        });
    }
}
