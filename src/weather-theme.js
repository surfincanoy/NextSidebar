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
    const key = String(icon ?? '');
    return Object.hasOwn(XIAOMI_CATEGORIES, key) ? XIAOMI_CATEGORIES[key] : 'overcast';
}
