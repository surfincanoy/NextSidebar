// 卡片定位：三张卡片整体靠屏幕左侧，垂直方向位于上方约 16% 处。
// 返回 [x, y]；leftMargin 为距屏幕左边缘的像素。
export function cardPosition(monitor, leftMargin = 24) {
    const x = monitor.x + leftMargin;
    const y = monitor.y + Math.round(monitor.height * 0.16);
    return [x, Math.max(monitor.y, y)];
}
