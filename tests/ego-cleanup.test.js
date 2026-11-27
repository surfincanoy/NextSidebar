import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(join(root, name), 'utf8');

test('EGO 反模式：断开信号不再包 try/catch', () => {
    for (const file of ['src/sliders.js', 'src/audio-stream.js']) {
        assert.doesNotMatch(read(file), /try\s*\{[\s\S]{0,160}?disconnect\(/,
            `${file} 仍有 disconnect 外包 try/catch`);
    }
});

test('EGO 反模式：显示器几何读取不再包 try/catch', () => {
    assert.doesNotMatch(read('src/sidebar-geometry.js'), /\btry\s*\{/);
});

test('EGO 反模式：HoverTrigger 不再用 _destroyed 布尔守卫', () => {
    assert.doesNotMatch(read('src/hover-trigger.js'), /_destroyed/);
});

test('EGO 反模式：applyCardOpacity 不再对 St.Widget 方法做 typeof 检查', () => {
    const source = read('src/card-opacity.js');
    assert.doesNotMatch(source, /typeof actor\.has_style_class_name/);
    assert.doesNotMatch(source, /if \(!actor\) return/);
});
