// 表盘几何与指针角度，数值来自 NextKde 的 DeskClockFace.qml

/** 三根指针的旋转角度（度），12 点方向为 0 */
export function handAngles(hours, minutes, seconds) {
    return {
        hour: (hours % 12 + minutes / 60) * 30,
        minute: minutes * 6,
        second: seconds * 6,
    };
}

/** 表盘几何：半径 = 尺寸/2 - 3，数字环 = 0.68R，字号 = max(10, round(0.18R)) */
export function dialGeometry(size) {
    const radius = Math.max(0, size / 2 - 3);
    return {
        radius,
        numeralRadius: radius * 0.68,
        numeralSize: Math.max(10, Math.round(radius * 0.18)),
    };
}
