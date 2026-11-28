// 卡片/页片/滑块格的深色底板不透明度：设置项 0..100 映射到 rgba 的 alpha。
// St 的 CSS 引擎不支持变量，运行时把计算出的底色写进对应 actor 的 inline style。

export function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 50;
    return Math.max(0, Math.min(100, Math.round(n)));
}

export function scrimStyle(percent, lower = false) {
    const base = clampPercent(percent) / 100;
    const raw = lower ? base + 0.07 : base;
    const alpha = Math.min(1, Math.round(raw * 100) / 100);
    return `background-color: rgba(0, 0, 0, ${alpha})`;
}

export function applyCardOpacity(root, percent) {
    if (!root) return;

    const visit = actor => {
        // 天气图标来自 St.TextureCache，是 Clutter.Actor 而非 St.Widget，没有样式方法
        if (!actor?.has_style_class_name)
            return;
        if (actor.has_style_class_name('ns-flip-half-lower'))
            actor.set_style(scrimStyle(percent, true));
        else if (actor.has_style_class_name('dw-card') ||
                 actor.has_style_class_name('ns-slider-section') ||
                 actor.has_style_class_name('ns-flip-half-upper'))
            actor.set_style(scrimStyle(percent));

        for (const child of actor.get_children?.() ?? [])
            visit(child);
    };
    visit(root);
}
