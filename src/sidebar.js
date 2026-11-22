// 右侧滑出侧栏容器：用 addChrome 挂遮罩与外壳，外壳带 popup-menu-content 跟随系统明暗主题。
// 卡片本体视觉不变，主题跟随只作用于外壳与其中的滑块。
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { HoverTrigger } from './hover-trigger.js';

export const SIDEBAR_WIDTH = 360;
export const ANIM_DURATION = 250;
// 右边缘触发条：宽 6px、鼠标停留 250ms 弹出；离开侧栏 5 秒后自动收起
export const EDGE_WIDTH = 6;
export const EDGE_DWELL_MS = 250;
export const AUTO_HIDE_MS = 5000;

// GLib 定时器适配成 HoverTrigger 需要的 schedule/cancel 接口
function schedule(fn, ms) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        fn();
        return GLib.SOURCE_REMOVE;
    });
}
function cancel(id) {
    GLib.source_remove(id);
}

export class Sidebar {
    constructor() {
        this._open = false;
        this._hover = new HoverTrigger({
            dwellMs: EDGE_DWELL_MS,
            hideMs: AUTO_HIDE_MS,
            onOpen: () => this.show(),
            onClose: () => this.hide(),
            schedule,
            cancel,
        });
        // 边缘触发条先建、外壳后建，保证侧栏打开时外壳盖在触发条之上
        this._buildEdge();
        this._buildOverlay();
        this._buildShell();
        this._connectHoverSignals();
    }

    get content() {
        return this._content;
    }

    get isOpen() {
        return this._open;
    }

    toggle() {
        if (this._open) this.hide();
        else this.show();
    }

    show() {
        if (this._open) return;
        this._open = true;
        // 手动开合时清掉待触发的悬停定时器，避免随后又弹/又收
        this._hover.cancelAll();

        // 每次 show 重读当前主显示器几何，处理多屏与显示器变更
        const monitor = this._getMonitor();
        const panelH = Main.panel.height;
        // 触发条同样跟随当前主显示器
        this._edge.set_position(monitor.x + monitor.width - EDGE_WIDTH, monitor.y + panelH);
        this._edge.set_size(EDGE_WIDTH, monitor.height - panelH);
        this._overlay.set_position(monitor.x, monitor.y);
        this._overlay.set_size(monitor.width, monitor.height);
        this._overlay.show();

        this._shell.set_position(monitor.x + monitor.width, monitor.y + panelH);
        this._shell.set_size(SIDEBAR_WIDTH, monitor.height - panelH);
        this._shell.show();
        Main.layoutManager.uiGroup.set_child_above_sibling(this._shell, this._overlay);

        this._shell.remove_all_transitions();
        this._shell.ease({
            translation_x: -SIDEBAR_WIDTH,
            duration: ANIM_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    hide() {
        if (!this._open) return;
        this._open = false;
        this._hover.cancelAll();
        this._overlay.hide();
        this._shell.remove_all_transitions();
        this._shell.ease({
            translation_x: 0,
            duration: ANIM_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._shell) this._shell.hide();
            },
        });
    }

    destroy() {
        this._open = false;
        this._hover?.destroy();
        this._hover = null;
        if (this._edge) {
            Main.layoutManager.removeChrome(this._edge);
            this._edge.destroy();
            this._edge = null;
        }
        if (this._shell) {
            this._shell.remove_all_transitions();
            this._shell.translation_x = 0;
        }
        if (this._overlay) {
            Main.layoutManager.removeChrome(this._overlay);
            this._overlay.destroy();
            this._overlay = null;
        }
        if (this._shell) {
            Main.layoutManager.removeChrome(this._shell);
            this._shell.destroy();
            this._shell = null;
        }
        this._content = null;
    }

    // primaryMonitor 可能在启动早期或多屏嵌套会话里为空，回退到固定几何避免崩溃
    _getMonitor() {
        return Main.layoutManager.primaryMonitor ??
            Main.layoutManager.monitors[0] ??
            { x: 0, y: 0, width: 1920, height: 1080 };
    }

    // 右边缘窄触发条：透明但可响应鼠标，贴在主显示器右侧（面板下方）
    _buildEdge() {
        const monitor = this._getMonitor();
        const panelH = Main.panel.height;
        this._edge = new St.Widget({
            reactive: true,
            opacity: 0,
            x: monitor.x + monitor.width - EDGE_WIDTH,
            y: monitor.y + panelH,
            width: EDGE_WIDTH,
            height: monitor.height - panelH,
        });
        Main.layoutManager.addChrome(this._edge, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    // 触发条与外壳的进入/离开事件接到状态机；侧栏打开时外壳盖住触发条，
    // 此时外壳的 enter 会取消收起倒计时——符合"移回侧栏取消 5 秒倒计时"
    _connectHoverSignals() {
        this._edge.connect('enter-event', () => {
            this._hover?.edgeEnter(this._open);
            return Clutter.EVENT_PROPAGATE;
        });
        this._edge.connect('leave-event', () => {
            this._hover?.edgeLeave();
            return Clutter.EVENT_PROPAGATE;
        });
        this._shell.connect('enter-event', () => {
            this._hover?.panelEnter();
            return Clutter.EVENT_PROPAGATE;
        });
        this._shell.connect('leave-event', () => {
            this._hover?.panelLeave();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _buildOverlay() {
        const monitor = this._getMonitor();
        this._overlay = new St.Widget({
            reactive: true,
            visible: false,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
        });
        this._overlay.connect('button-press-event', () => {
            this.hide();
            return Clutter.EVENT_STOP;
        });
        Main.layoutManager.addChrome(this._overlay, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _buildShell() {
        const monitor = this._getMonitor();
        const panelH = Main.panel.height;
        this._shell = new St.BoxLayout({
            style_class: 'popup-menu-content next-sidebar',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: true,
            visible: false,
            width: SIDEBAR_WIDTH,
            height: monitor.height - panelH,
            x: monitor.x + monitor.width,
            y: monitor.y + panelH,
        });

        // 滚动内容区：三卡与滑块竖向排列，超高时可滚动
        const scroll = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            // 隐藏滚动条外观但保留滚动：必须用 EXTERNAL，不能用 NEVER。
            // NEVER 会把 ScrollView 最小高度撑到内容全高，内容不再溢出，滚轮无效（真机证伪）；
            // EXTERNAL 既让滚动条不可见，又保持内容可滚（GNOME appDisplay 同款做法）。
            vscrollbar_policy: St.PolicyType.EXTERNAL,
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
        });
        this._content = new St.BoxLayout({
            style_class: 'next-sidebar-content',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            reactive: false,
        });
        scroll.add_child(this._content);
        this._shell.add_child(scroll);

        Main.layoutManager.addChrome(this._shell, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }
}
