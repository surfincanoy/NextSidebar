// 月历网格生成：周一起始，含上下月补位与今天高亮
import { lunarDayForDate } from './lunar-date.js';
import { solarTermForDate } from './solar-term.js';
import { holidayForDate } from './holiday.js';

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/**
 * 生成某月的日历网格。
 * @param {number} year 公历年
 * @param {number} month 月份 1-12
 * @param {object|null} today {year, month, day}，落在当月时才高亮
 * @returns {{cells: Array, weekdays: string[]}} cells 每格含 year/month/day/lunar/solarTerm/holiday/isCurrentMonth/isToday
 */
export function buildMonthGrid(year, month, today = null) {
    // getDay() 0=周日，换算成周一=0 的偏移
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const offset = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    // 补齐到完整周数
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
        let day;
        let monthDelta;
        if (i < offset) {
            day = daysInPrevMonth - offset + 1 + i;
            monthDelta = -1;
        } else if (i < offset + daysInMonth) {
            day = i - offset + 1;
            monthDelta = 0;
        } else {
            day = i - (offset + daysInMonth) + 1;
            monthDelta = 1;
        }
        // 用 Date 归一化跨年月份（1 月往前补到 12 月，12 月往后补到次年 1 月），
        // 让补位格也带真实公历年/月，供农历换算使用。
        const cellDate = new Date(year, month - 1 + monthDelta, 1);
        const cellYear = cellDate.getFullYear();
        const cellMonth = cellDate.getMonth() + 1;
        const isCurrentMonth = monthDelta === 0;
        cells.push({
            year: cellYear,
            month: cellMonth,
            day,
            lunar: lunarDayForDate(cellYear, cellMonth, day),
            solarTerm: solarTermForDate(cellYear, cellMonth, day),
            holiday: holidayForDate(cellYear, cellMonth, day),
            isCurrentMonth,
            isToday: !!today && isCurrentMonth &&
                today.year === year && today.month === month && today.day === day,
        });
    }
    return { cells, weekdays: WEEKDAYS };
}
