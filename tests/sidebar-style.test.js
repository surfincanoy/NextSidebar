import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'stylesheet.css'), 'utf8');

test('外壳透明规则用复合选择器压过主题 .popup-menu-content', () => {
    const rule = css.match(/\.popup-menu-content\.next-sidebar\s*\{([\s\S]*?)\}/);

    assert.ok(rule, '缺少 .popup-menu-content.next-sidebar 复合选择器');
    assert.match(rule[1], /background-color:\s*transparent/);
    assert.match(rule[1], /box-shadow:\s*none/);
    assert.match(rule[1], /border-width:\s*0/);
});

test('旧的单类 .next-sidebar 外壳规则已移除，避免同特异性被主题覆盖', () => {
    assert.doesNotMatch(css, /(^|\n)\.next-sidebar\s*\{/);
});

test('卡片和滑块格不使用会溢出到间距的外阴影', () => {
    for (const selector of ['.dw-card', '.ns-slider-section']) {
        const rule = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`));
        assert.ok(rule, `缺少 ${selector} 规则`);
        assert.doesNotMatch(rule[1], /box-shadow:\s*(?!none)/);
    }
});

test('外壳仍保留 popup-menu-content 以继承主题前景色', () => {
    const source = readFileSync(join(root, 'src/sidebar.js'), 'utf8');
    assert.match(source, /style_class:\s*'popup-menu-content'/);
    assert.match(source, /add_style_class_name\('next-sidebar'\)/);
});
