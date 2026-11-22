// 天气分类 + 昼夜 -> Breezy Weather 图标文件名（资源见 icons/SOURCES.md）
// 晴/多云分昼夜，其余天气昼夜共用一张图。

const ICONS = {
    clear: { day: 'weather_clear_day.png', night: 'weather_clear_night.png' },
    partlyCloudy: { day: 'weather_partly_cloudy_day.png', night: 'weather_partly_cloudy_night.png' },
    overcast: 'weather_cloudy.png',
    fog: 'weather_fog.png',
    rain: 'weather_rain.png',
    snow: 'weather_snow.png',
    storm: 'weather_thunderstorm.png',
    hail: 'weather_hail.png',
    haze: 'weather_haze.png',
};

export function iconForCategory(category, isDay) {
    const icon = ICONS[category] ?? ICONS.overcast;
    if (typeof icon === 'string') return icon;
    return isDay ? icon.day : icon.night;
}
