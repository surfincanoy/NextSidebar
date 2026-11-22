// 城市 -> 时区的统一解析：预设城市用 IANA ID，自定义城市用保存的固定偏移。
import GLib from 'gi://GLib';

import { presetCity } from './cities.js';
import { parseCustomCities } from './custom-cities.js';

/** 解析城市时区；从未见过的城市返回 null，由调用方退回系统本地时区。 */
export function timezoneForCity(city, customCityStrings) {
    const preset = presetCity(city);
    if (preset)
        return GLib.TimeZone.new(preset.timezone);

    const custom = parseCustomCities(customCityStrings).find(item => item.name === city);
    if (custom && Number.isFinite(custom.timeZoneShift))
        return GLib.TimeZone.new_offset(custom.timeZoneShift);
    return null;
}

/** 把 GLib.DateTime 拆成表盘指针与日历都用的字段。 */
export function dateTimeParts(dt) {
    return {
        year: dt.get_year(),
        month: dt.get_month(),
        day: dt.get_day_of_month(),
        hour: dt.get_hour(),
        minute: dt.get_minute(),
        second: dt.get_second(),
    };
}
