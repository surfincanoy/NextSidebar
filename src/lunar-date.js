// 农历日期：用 GJS 自带 ICU 的 chinese 历法算公历日期对应的农历月/日，无需第三方库。

const LUNAR_DAY_NAMES = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

// 把 1–30 的农历日映射成中文写法；非法值返回 null。
export function lunarDayName(day) {
    if (!Number.isInteger(day) || day < 1 || day > 30) {
        return null;
    }
    return LUNAR_DAY_NAMES[day - 1];
}

// timeZone 固定为 UTC，配合 Date.UTC 避免本地时区导致差一天。
const formatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
});

// 返回公历日期对应的 { month, day, isLeap }：month 1-12，day 1-30，闰月时 isLeap=true。
// ICU 的 month 字段形如 "11"、"1"、"闰6"，闰月带前缀。
export function lunarMonthDayForDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    let lunarMonth = 0;
    let lunarDay = 0;
    let isLeap = false;
    for (const part of formatter.formatToParts(date)) {
        if (part.type === 'month') {
            isLeap = part.value.startsWith('闰');
            lunarMonth = parseInt(isLeap ? part.value.slice(1) : part.value, 10);
        } else if (part.type === 'day') {
            lunarDay = parseInt(part.value, 10);
        }
    }
    return { month: lunarMonth, day: lunarDay, isLeap };
}

export function lunarDayForDate(year, month, day) {
    const lunar = lunarMonthDayForDate(year, month, day);
    return lunarDayName(lunar.day);
}

// 除夕：农历腊月（12 月，非闰月）的最后一天，即次日进入正月初一。
// 腊月大小月不固定（29 或 30 天），不能用固定日号，须比较次日月份。
export function isLunarNewYearEve(year, month, day) {
    const today = lunarMonthDayForDate(year, month, day);
    if (today.isLeap || today.month !== 12) {
        return false;
    }
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const tomorrow = lunarMonthDayForDate(
        next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
    return tomorrow.month === 1 && tomorrow.day === 1 && !tomorrow.isLeap;
}
