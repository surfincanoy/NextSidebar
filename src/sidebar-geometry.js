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

// 触发条只占顶栏下方可用高度的正中间三分之一，上下各留三分之一不触发。
export function edgeGeometry(monitor, panelH) {
    const third = Math.max(0, (monitor.height - panelH) / 3);
    return {
        y: monitor.y + panelH + third,
        height: third,
    };
}

function isUsableRect(rect) {
    return !!rect
        && Number.isFinite(rect.x)
        && Number.isFinite(rect.y)
        && rect.width > 0
        && rect.height > 0;
}

// 按优先级挑第一个有效的显示器几何；全无效才回退到调用方给的兜底。
// 有效性包含有限坐标与正数尺寸，避免拿到初始化未完成或坐标损坏的 monitor。
export function pickMonitor(candidates, fallback) {
    for (const m of candidates) {
        if (isUsableRect(m))
            return m;
    }
    return fallback;
}

function normalizeRect(rect) {
    if (!isUsableRect(rect))
        return null;
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function displayGeometry(display, index) {
    return normalizeRect(display.get_monitor_geometry(index));
}

function geometryFromDisplay(display) {
    const index = display.get_primary_monitor();
    const primaryIndex = index >= 0 ? index : 0;
    return displayGeometry(display, primaryIndex) ?? displayGeometry(display, 0);
}

// 运行时按优先级取真实显示器几何：layoutManager 主显示器 → 第一块显示器 →
// Meta.Display 几何；都拿不到才用调用方的硬编码兜底。
export function monitorFromRuntime(layoutManager, display, fallback) {
    return pickMonitor([
        layoutManager.primaryMonitor,
        layoutManager.monitors[0],
        geometryFromDisplay(display),
    ], fallback);
}

// 订阅显示器变化，返回的解绑函数在 destroy() 中调用。
export function followMonitorChanges(layoutManager, onChanged) {
    const id = layoutManager.connect('monitors-changed', onChanged);
    return () => layoutManager.disconnect(id);
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
