// 翻页时钟的纯数字逻辑：24 小时制时分拆成四位，并决定每一位是否翻页。
// 与 St/Clutter 无关，便于直接 import 做真实行为测试。

// 拆分时分四位：HH:MM 各补零到两位，返回 [时十位, 时个位, 分十位, 分个位]。
export function clockDigits(hours, minutes) {
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    return [h[0], h[1], m[0], m[1]];
}

// 对比上次显示的四位与当前时间，给出每一位的翻页决策。
// previous 为空数组时是首次显示：四位就位但不翻页。
export function flipChanges(previous, hours, minutes) {
    return clockDigits(hours, minutes).map((to, index) => {
        const from = previous[index] ?? to;
        return { index, from, to, changed: previous.length > 0 && from !== to };
    });
}
