import test from 'node:test';
import assert from 'node:assert/strict';
import {
    POSITIONS, SIDEBAR_WIDTH, EDGE_WIDTH,
    normalizePosition, edgeX, shellX, slideInX, shellTranslation,
} from '../src/sidebar-geometry.js';

const monitor = { x: 100, y: 50, width: 1920, height: 1080 };

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
