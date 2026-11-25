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

// 白字压在任意壁纸上都要够对比，底板必须从很淡的强调色改成深色半透明
function darkScrimAlpha(selector) {
    const rule = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(rule, `缺少 ${selector} 规则`);
    const match = rule[1].match(/background-color:\s*rgba\(\s*0,\s*0,\s*0,\s*([\d.]+)\s*\)/);
    assert.ok(match, `${selector} 没有深色半透明底，白字在白壁纸上会看不清`);
    const alpha = Number(match[1]);
    assert.ok(alpha >= 0.5, `${selector} 的深色底太淡`);
    return alpha;
}

test('卡片、滑块格和翻页页片用深色半透明底托住白字', () => {
    for (const selector of ['.dw-card', '.ns-slider-section',
        '.ns-flip-half-upper', '.ns-flip-half-lower']) {
        darkScrimAlpha(selector);
    }
});

test('深色底不过重，保留半透明观感', () => {
    for (const selector of ['.dw-card', '.ns-slider-section', '.ns-flip-half-upper']) {
        assert.ok(darkScrimAlpha(selector) <= 0.5, `${selector} 太暗`);
    }
});

test('翻页下半片比上半片更深，保留机械翻页的明暗差', () => {
    const upper = darkScrimAlpha('.ns-flip-half-upper');
    const lower = darkScrimAlpha('.ns-flip-half-lower');

    assert.ok(lower > upper);
});

test('外壳仍保留 popup-menu-content 以继承主题前景色', () => {
    const source = readFileSync(join(root, 'src/sidebar.js'), 'utf8');
    assert.match(source, /style_class:\s*'popup-menu-content'/);
    assert.match(source, /add_style_class_name\('next-sidebar'\)/);
});
