// 二十四节气：用太阳视黄经 + 牛顿迭代求交节时刻（Meeus 低精度公式），换算到北京时间取日期。
// 精度在分钟级，足以稳定到「日」，且不受 1900-2100 数据表的年份范围限制。纯计算、零依赖。

const RAD = Math.PI / 180;

// 按公历月序排列：每月两个节气，小寒起。索引 = (月-1)*2 + (上旬=0/下旬=1)。
export const SOLAR_TERMS = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

// 每个节气对应的太阳视黄经（度）。小寒 285°，立春 315°，春分 0°，冬至 270°。
const TERM_LONGITUDE = [
    285, 300, 315, 330, 345, 0, 15, 30,
    45, 60, 75, 90, 105, 120, 135, 150,
    165, 180, 195, 210, 225, 240, 255, 270,
];

// 儒略日 <-> 公历（格里高利历）。JD 的正午对应 0.5 小数部分。
function jdFromDate(year, month, day) {
    let y = year;
    let m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

function jdToParts(jd) {
    const Z = Math.floor(jd + 0.5);
    const F = jd + 0.5 - Z;
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    const A = Z + 1 + alpha - Math.floor(alpha / 4);
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const dayF = B - D - Math.floor(30.6001 * E) + F;
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return { year, month, day: Math.floor(dayF) };
}

// 太阳视黄经（度）：平黄经 + 中心差 - 章动/光行差近似。
function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = M * RAD;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
            + 0.000289 * Math.sin(3 * Mr);
    const omega = (125.04 - 1934.136 * T) * RAD;
    return L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
}

// 求某年中太阳视黄经到达 targetLon 的儒略日（力学时尺度，忽略 ΔT）。
function termJD(year, targetLon) {
    const yearStart = jdFromDate(year, 1, 1);
    let jd = yearStart + ((targetLon - 280 + 360) % 360) / 0.9856;
    for (let i = 0; i < 10; i++) {
        let diff = sunLongitude(jd) - targetLon;
        diff = ((diff + 180) % 360 + 360) % 360 - 180;
        jd -= diff / 0.9856;
        if (Math.abs(diff) < 1e-8) break;
    }
    return jd;
}

// 返回公历日期对应的节气名，非交节日返回 null。节气日期按北京时间（UT+8）判定。
export function solarTermForDate(year, month, day) {
    for (let i = 0; i < TERM_LONGITUDE.length; i++) {
        const bj = jdToParts(termJD(year, TERM_LONGITUDE[i]) + 8 / 24);
        if (bj.year === year && bj.month === month && bj.day === day) {
            return SOLAR_TERMS[i];
        }
    }
    return null;
}
