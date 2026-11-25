import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { clampPercent, scrimStyle, applyCardOpacity } from '../src/card-opacity.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeActor(classes = []) {
    return {
        classes: new Set(classes),
        style: null,
        children: [],
        has_style_class_name(name) {
            return this.classes.has(name);
        },
        set_style(style) {
            this.style = style;
        },
        get_children() {
            return this.children;
        },
    };
}

test('clampPercent 把设置值约束到 0..100 的整数', () => {
    assert.equal(clampPercent(-10), 0);
    assert.equal(clampPercent(0), 0);
    assert.equal(clampPercent(50), 50);
    assert.equal(clampPercent(100), 100);
    assert.equal(clampPercent(200), 100);
    assert.equal(clampPercent(33.6), 34);
    assert.equal(clampPercent('abc'), 50);
});

test('scrimStyle 生成深色半透明底色', () => {
    assert.equal(scrimStyle(0), 'background-color: rgba(0, 0, 0, 0)');
    assert.equal(scrimStyle(50), 'background-color: rgba(0, 0, 0, 0.5)');
    assert.equal(scrimStyle(100), 'background-color: rgba(0, 0, 0, 1)');
});

test('翻页下半片始终比上半片深 7%，且不超过全不透明', () => {
    assert.equal(scrimStyle(50, true), 'background-color: rgba(0, 0, 0, 0.57)');
    assert.equal(scrimStyle(100, true), 'background-color: rgba(0, 0, 0, 1)');
});

test('applyCardOpacity 递归作用于卡片、页片和滑块格', () => {
    const card = makeActor(['dw-card']);
    const slider = makeActor(['ns-slider-section']);
    const upper = makeActor(['ns-flip-half-upper']);
    const lower = makeActor(['ns-flip-half-lower']);
    const unrelated = makeActor(['dw-cal-today']);
    const nestedCard = makeActor(['dw-card']);
    unrelated.children.push(nestedCard);

    const root = makeActor(['next-sidebar-content']);
    root.children.push(card, slider, upper, lower, unrelated);

    applyCardOpacity(root, 40);

    assert.equal(card.style, 'background-color: rgba(0, 0, 0, 0.4)');
    assert.equal(slider.style, 'background-color: rgba(0, 0, 0, 0.4)');
    assert.equal(upper.style, 'background-color: rgba(0, 0, 0, 0.4)');
    assert.equal(lower.style, 'background-color: rgba(0, 0, 0, 0.47)');
    assert.equal(unrelated.style, null, '不应覆盖今天高亮等非底板元素');
    assert.equal(nestedCard.style, 'background-color: rgba(0, 0, 0, 0.4)');
});

test('schema 提供 card-opacity 键，默认 50、范围 0..100', () => {
    const xml = readFileSync(join(root, 'schemas/org.gnome.shell.extensions.nextsidebar.gschema.xml'), 'utf8');
    const key = xml.match(/<key name="card-opacity"[\s\S]*?<\/key>/);

    assert.ok(key, '缺少 card-opacity 设置键');
    assert.match(key[0], /type="i"/);
    assert.match(key[0], /<default>50<\/default>/);
    assert.match(key[0], /<range min="0" max="100"\/>/);
});

test('设置页提供可实时调节的不透明度滑块', () => {
    const prefs = readFileSync(join(root, 'prefs.js'), 'utf8');

    assert.match(prefs, /card-opacity/);
    assert.match(prefs, /Gtk\.Scale|Gtk\.Adjustment/);
});

test('扩展监听 card-opacity 并在重建后重新应用', () => {
    const source = readFileSync(join(root, 'extension.js'), 'utf8');

    assert.match(source, /changed::card-opacity/);
    assert.match(source, /applyCardOpacity/);
    assert.ok(source.indexOf('applyCardOpacity') < source.indexOf('disable() {') ||
        source.split('applyCardOpacity').length > 2);
});
