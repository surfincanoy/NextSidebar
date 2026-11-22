import test from 'node:test';
import assert from 'node:assert/strict';
import { HoverTrigger } from '../src/hover-trigger.js';

test('cancelAll 取消待触发的弹出与收起', () => {
    const pending = new Map();
    let nextId = 0;
    const schedule = (fn, ms) => {
        const id = ++nextId;
        pending.set(id, fn);
        return id;
    };
    const cancel = id => pending.delete(id);
    let opened = 0;
    let closed = 0;
    const hover = new HoverTrigger({
        dwellMs: 250,
        hideMs: 5000,
        onOpen: () => opened++,
        onClose: () => closed++,
        schedule,
        cancel,
    });
    hover.edgeEnter(false);
    hover.panelLeave();
    hover.cancelAll();
    for (const fn of pending.values()) fn();
    assert.equal(opened, 0);
    assert.equal(closed, 0);
    hover.destroy();
});
