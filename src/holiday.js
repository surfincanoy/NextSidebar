// 节日：公历固定节日、农历固定节日、除夕，以及节气同名的清明。
// 农历节日按农历月日匹配，闰月不算（端午只在五月，不在闰五月）。
import { lunarMonthDayForDate, isLunarNewYearEve } from './lunar-date.js';
import { solarTermForDate } from './solar-term.js';

// 公历节日：键为「月-日」
const GREGORIAN_HOLIDAYS = {
    '1-1': '元旦',
    '3-8': '妇女节',
    '3-12': '植树节',
    '5-1': '劳动节',
    '5-4': '青年节',
    '6-1': '儿童节',
    '7-1': '建党节',
    '8-1': '建军节',
    '9-10': '教师节',
    '10-1': '国庆节',
};

// 农历节日：键为「月-日」，仅非闰月生效
const LUNAR_HOLIDAYS = {
    '1-1': '春节',
    '1-15': '元宵',
    '5-5': '端午',
    '7-7': '七夕',
    '8-15': '中秋',
    '9-9': '重阳',
};

export function holidayForDate(year, month, day) {
    const gregorian = GREGORIAN_HOLIDAYS[`${month}-${day}`];
    if (gregorian) {
        return gregorian;
    }

    const lunar = lunarMonthDayForDate(year, month, day);
    if (!lunar.isLeap) {
        const lunarHoliday = LUNAR_HOLIDAYS[`${lunar.month}-${lunar.day}`];
        if (lunarHoliday) {
            return lunarHoliday;
        }
        if (isLunarNewYearEve(year, month, day)) {
            return '除夕';
        }
    }

    // 清明既是节气又是传统节日，由节气模块覆盖
    if (solarTermForDate(year, month, day) === '清明') {
        return '清明';
    }

    return null;
}
