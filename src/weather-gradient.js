// 天气卡渐变配色：按天气分类 + 昼夜给出上深下浅的起止色。
// 晴日基准取自参考截图（顶 #242d75 / 底 #3c49b0）；其余分类在同一深蓝基调上做色相微调。

const DAY_COLORS = {
    clear: { top: '#242d75', bottom: '#3c49b0' },
    partlyCloudy: { top: '#2f3b7d', bottom: '#4656ad' },
    overcast: { top: '#3a4055', bottom: '#566080' },
    fog: { top: '#4a4f60', bottom: '#6a7185' },
    rain: { top: '#1e3a5c', bottom: '#34577d' },
    snow: { top: '#3a4a70', bottom: '#5a6d9a' },
    storm: { top: '#2a2450', bottom: '#453d75' },
};

const NIGHT_FACTOR = 0.65;

function darken(hex, factor) {
    const parts = [1, 3, 5].map(i => {
        const v = Math.round(parseInt(hex.slice(i, i + 2), 16) * factor);
        return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    });
    return `#${parts.join('')}`;
}

/** 返回 { top, bottom } 的 #rrggbb；未知分类回退到阴天。 */
export function gradientColors(category, isDay) {
    const colors = DAY_COLORS[category] ?? DAY_COLORS.overcast;
    if (isDay) return { ...colors };
    return {
        top: darken(colors.top, NIGHT_FACTOR),
        bottom: darken(colors.bottom, NIGHT_FACTOR),
    };
}
