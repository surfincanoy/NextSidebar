// 预设城市表：扩展与设置窗口共用。
// 时区用 IANA ID（如 Asia/Shanghai），可自动处理夏令时；表外城市走小米返回的 timeZoneShift。
export const PRESET_CITIES = [
    { name: '北京', timezone: 'Asia/Shanghai' },
    { name: '上海', timezone: 'Asia/Shanghai' },
    { name: '广州', timezone: 'Asia/Shanghai' },
    { name: '深圳', timezone: 'Asia/Shanghai' },
    { name: '杭州', timezone: 'Asia/Shanghai' },
    { name: '南京', timezone: 'Asia/Shanghai' },
    { name: '苏州', timezone: 'Asia/Shanghai' },
    { name: '成都', timezone: 'Asia/Shanghai' },
    { name: '重庆', timezone: 'Asia/Shanghai' },
    { name: '武汉', timezone: 'Asia/Shanghai' },
    { name: '西安', timezone: 'Asia/Shanghai' },
    { name: '天津', timezone: 'Asia/Shanghai' },
    { name: '青岛', timezone: 'Asia/Shanghai' },
    { name: '厦门', timezone: 'Asia/Shanghai' },
    { name: '昆明', timezone: 'Asia/Shanghai' },
    { name: '长沙', timezone: 'Asia/Shanghai' },
    { name: '郑州', timezone: 'Asia/Shanghai' },
    { name: '哈尔滨', timezone: 'Asia/Shanghai' },
    { name: '沈阳', timezone: 'Asia/Shanghai' },
    { name: '大连', timezone: 'Asia/Shanghai' },
    { name: '香港', timezone: 'Asia/Hong_Kong' },
    { name: '澳门', timezone: 'Asia/Macau' },
    { name: '台北', timezone: 'Asia/Taipei' },
    { name: '东京', timezone: 'Asia/Tokyo' },
    { name: '大阪', timezone: 'Asia/Tokyo' },
    { name: '首尔', timezone: 'Asia/Seoul' },
    { name: '新加坡', timezone: 'Asia/Singapore' },
    { name: '曼谷', timezone: 'Asia/Bangkok' },
    { name: '迪拜', timezone: 'Asia/Dubai' },
    { name: '莫斯科', timezone: 'Europe/Moscow' },
    { name: '伦敦', timezone: 'Europe/London' },
    { name: '巴黎', timezone: 'Europe/Paris' },
    { name: '柏林', timezone: 'Europe/Berlin' },
    { name: '纽约', timezone: 'America/New_York' },
    { name: '洛杉矶', timezone: 'America/Los_Angeles' },
    { name: '悉尼', timezone: 'Australia/Sydney' },
    { name: '墨尔本', timezone: 'Australia/Melbourne' },
];

/** 查预设城市；表外城市返回 null，由天气接口的 timeZoneShift 决定时区。 */
export function presetCity(name) {
    return PRESET_CITIES.find(city => city.name === name) ?? null;
}
