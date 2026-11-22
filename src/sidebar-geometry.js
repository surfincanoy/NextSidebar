// 侧边栏位置相关的纯几何计算，不依赖 GI，便于 Node 单元测试。
export const SIDEBAR_WIDTH = 360;
export const EDGE_WIDTH = 6;
export const POSITIONS = ['right', 'left'];

export function normalizePosition(value) {
    return POSITIONS.includes(value) ? value : POSITIONS[0];
}

export function edgeX(monitor, position) {
    return position === 'left'
        ? monitor.x
        : monitor.x + monitor.width - EDGE_WIDTH;
}

export function shellX(monitor, position) {
    return position === 'left'
        ? monitor.x - SIDEBAR_WIDTH
        : monitor.x + monitor.width;
}

export function slideInX(position) {
    return position === 'left' ? SIDEBAR_WIDTH : -SIDEBAR_WIDTH;
}

export function shellTranslation(position, isOpen) {
    return isOpen ? slideInX(position) : 0;
}
