import test from 'node:test';
import assert from 'node:assert/strict';
import {
    POSITIONS, SIDEBAR_WIDTH, EDGE_WIDTH,
    normalizePosition, edgeX, shellX, slideInX, shellTranslation, edgeGeometry, pickMonitor,
    monitorFromRuntime, followMonitorChanges,
} from '../src/sidebar-geometry.js';

const monitor = { x: 100, y: 50, width: 1920, height: 1080 };

test('固定尺寸保持需求约定', () => {
    assert.equal(SIDEBAR_WIDTH, 360);
    assert.equal(EDGE_WIDTH, 6);
});

test('合法位置与顺序', () => {
    assert.deepEqual(POSITIONS, ['right', 'left']);
    assert.equal(normalizePosition('right'), 'right');
    assert.equal(normalizePosition('left'), 'left');
});

test('非法值回退到右侧', () => {
    for (const value of [undefined, null, '', 'top', 42])
        assert.equal(normalizePosition(value), 'right');
});

test('触发条贴主显示器对应边缘', () => {
    assert.equal(edgeX(monitor, 'right'), 2014);
    assert.equal(edgeX(monitor, 'left'), 100);
});

test('触发条只覆盖侧边可用高度的正中间三分之一', () => {
    // 可用高度 1090-40=1050，三等分每份 350：上留 350、触发 350、下留 350
    const m = { x: 100, y: 50, width: 1920, height: 1090 };
    const geom = edgeGeometry(m, 40);
    assert.equal(geom.y, 440);
    assert.equal(geom.height, 350);
    assert.equal(geom.y - (m.y + 40), 350);
    assert.equal(m.y + m.height - (geom.y + geom.height), 350);

    // 面板比显示器还高时不能算出负高度或倒退的 y
    assert.deepEqual(edgeGeometry({ x: 0, y: 0, width: 800, height: 30 }, 40), { y: 40, height: 0 });
});

test('显示器几何按优先级取第一个有效值，全无效才用兜底', () => {
    const fallback = { x: 0, y: 0, width: 800, height: 600 };
    const primary = { x: 0, y: 0, width: 2560, height: 1440 };
    const display = { x: 100, y: 50, width: 3840, height: 2160 };

    assert.equal(pickMonitor([primary, display], fallback), primary);
    assert.equal(pickMonitor([null, display], fallback), display);
    assert.equal(pickMonitor([undefined, { width: 0, height: 0 }, display], fallback), display);
    assert.equal(pickMonitor([null, undefined], fallback), fallback);
    assert.equal(pickMonitor([{ x: NaN, y: 0, width: 100, height: 100 }], fallback), fallback);
    assert.equal(pickMonitor([{ x: 0, y: undefined, width: 100, height: 100 }], fallback), fallback);
});

test('显示器几何按运行时优先级读取，全部拿不到再兜底', () => {
    const fallback = { x: 0, y: 0, width: 1920, height: 1080 };
    const primary = { x: 0, y: 0, width: 2560, height: 1440 };
    const first = { x: 100, y: 0, width: 1280, height: 720 };
    const displayRect = { x: 200, y: 10, width: 3840, height: 2160 };
    const display = {
        get_primary_monitor: () => 0,
        get_monitor_geometry: (index) => (index === 0 ? displayRect : null),
    };

    assert.deepEqual(monitorFromRuntime({ primaryMonitor: primary, monitors: [first] }, display, fallback), primary);
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [first] }, display, fallback), first);
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, display, fallback), displayRect);
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, {
        get_primary_monitor: () => -1,
        get_monitor_geometry: (index) => (index === 0 ? displayRect : null),
    }, fallback), displayRect);

    const secondRect = { x: 300, y: 20, width: 1920, height: 1080 };
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, {
        get_primary_monitor: () => 1,
        get_monitor_geometry: (index) => (index === 1 ? secondRect : null),
    }, fallback), secondRect);
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, {
        get_primary_monitor: () => 1,
        get_monitor_geometry: (index) => (index === 0 ? displayRect : null),
    }, fallback), displayRect);
});

test('显示器几何返回 null 时回退到兜底几何', () => {
    const fallback = { x: 0, y: 0, width: 1920, height: 1080 };
    const emptyDisplay = {
        get_primary_monitor: () => -1,
        get_monitor_geometry: () => null,
    };

    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, emptyDisplay, fallback), fallback);
});

test('显示器 API 抛错时不再吞掉异常', () => {
    const fallback = { x: 0, y: 0, width: 1920, height: 1080 };
    const brokenDisplay = {
        get_primary_monitor: () => {
            throw new Error('no display');
        },
        get_monitor_geometry: () => {
            throw new Error('no display');
        },
    };

    assert.throws(() => monitorFromRuntime({ primaryMonitor: null, monitors: [] }, brokenDisplay, fallback),
        /no display/);
});

test('显示器几何坐标非有限值时跳过', () => {
    const fallback = { x: 0, y: 0, width: 1920, height: 1080 };
    assert.deepEqual(monitorFromRuntime({ primaryMonitor: null, monitors: [] }, {
        get_primary_monitor: () => 0,
        get_monitor_geometry: () => ({ x: NaN, y: 0, width: 1920, height: 1080 }),
    }, fallback), fallback);
});

test('显示器变化时可订阅刷新并可安全解绑', () => {
    let handler = null;
    let disconnectCount = 0;
    const layoutManager = {
        connect(signal, callback) {
            assert.equal(signal, 'monitors-changed');
            handler = callback;
            return 7;
        },
        disconnect(id) {
            assert.equal(id, 7);
            disconnectCount += 1;
        },
    };

    let refreshCount = 0;
    const dispose = followMonitorChanges(layoutManager, () => {
        refreshCount += 1;
    });
    assert.equal(typeof handler, 'function');
    handler();
    assert.equal(refreshCount, 1);
    dispose();
    assert.equal(disconnectCount, 1);
});

test('外壳闭合位置在主显示器外', () => {
    assert.equal(shellX(monitor, 'right'), 2020);
    assert.equal(shellX(monitor, 'left'), 100 - SIDEBAR_WIDTH);
});

test('滑入偏移与开关状态', () => {
    assert.equal(slideInX('right'), -SIDEBAR_WIDTH);
    assert.equal(slideInX('left'), SIDEBAR_WIDTH);
    assert.equal(shellTranslation('right', true), -SIDEBAR_WIDTH);
    assert.equal(shellTranslation('left', true), SIDEBAR_WIDTH);
    assert.equal(shellTranslation('right', false), 0);
    assert.equal(shellTranslation('left', false), 0);
});
