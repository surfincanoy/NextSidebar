// 天气 WMO code 分类与主题配色，数值逐项来自 NextKde 的 WeatherTheme.qml

// 小米天气码 -> 分类，映射表逐项来自 Breezy Weather 的 ChinaService.getWeatherCode
const XIAOMI_CATEGORIES = {
    '0': 'clear', '00': 'clear',
    '1': 'partlyCloudy', '01': 'partlyCloudy',
    '3': 'rain', '7': 'rain', '8': 'rain', '9': 'rain',
    '03': 'rain', '07': 'rain', '08': 'rain', '09': 'rain',
    '10': 'rain', '11': 'rain', '12': 'rain',
    '21': 'rain', '22': 'rain', '23': 'rain', '24': 'rain', '25': 'rain',
    '4': 'storm', '04': 'storm',
    '5': 'hail', '05': 'hail',
    '6': 'rain', '06': 'rain', '19': 'rain',
    '13': 'snow', '14': 'snow', '15': 'snow', '16': 'snow', '17': 'snow',
    '26': 'snow', '27': 'snow', '28': 'snow',
    '18': 'fog', '32': 'fog', '49': 'fog', '57': 'fog',
    '20': 'overcast', '29': 'overcast', '30': 'overcast',
    '53': 'haze', '54': 'haze', '55': 'haze', '56': 'haze',
};

export function categoryFromXiaomi(icon) {
    return XIAOMI_CATEGORIES[String(icon ?? '')] ?? 'overcast';
}

export function category(code) {
    const value = Number(code);
    if (value === 0) return 'clear';
    if (value >= 1 && value <= 2) return 'partlyCloudy';
    if (value === 3) return 'overcast';
    if (value === 45 || value === 48) return 'fog';
    // 80-82（阵雨）归为雨，必须先于雪区间判断
    if ((value >= 51 && value <= 67) || (value >= 80 && value <= 82)) return 'rain';
    if ((value >= 71 && value <= 77) || value === 85 || value === 86) return 'snow';
    if (value >= 95) return 'storm';
    return 'overcast';
}

export function theme(code, isDay) {
    switch (category(code)) {
        case 'clear':
            return isDay
                ? { primary: '#62b8ee', secondary: '#2c72bb', accent: '#ffe36a' }
                : { primary: '#293d78', secondary: '#111a3e', accent: '#c8d9ff' };
        case 'partlyCloudy':
            return isDay
                ? { primary: '#718fb0', secondary: '#3d5d82', accent: '#ffe07a' }
                : { primary: '#3b4b70', secondary: '#202a4c', accent: '#c4d3f1' };
        case 'fog':
            return { primary: '#9ba7b2', secondary: '#687582', accent: '#e3e8eb' };
        case 'rain':
            return { primary: '#4f789a', secondary: '#213a57', accent: '#caebff' };
        case 'snow':
            return { primary: '#7e9eb4', secondary: '#405970', accent: '#f4fbff' };
        case 'storm':
            return { primary: '#36416a', secondary: '#16182d', accent: '#e0ccff' };
        case 'overcast':
        default:
            return { primary: '#687786', secondary: '#3f4b5a', accent: '#d8e0e8' };
    }
}
