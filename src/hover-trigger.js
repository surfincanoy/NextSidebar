// 悬停状态机：鼠标在右边缘停留后请求弹出，离开侧栏延时后请求收起，移回则取消。
// 只管状态与定时器，不依赖 GNOME Shell 运行时，便于用假时钟做真实行为测试。
export class HoverTrigger {
    constructor({ dwellMs = 250, hideMs = 5000, onOpen, onClose, schedule, cancel } = {}) {
        this._dwellMs = dwellMs;
        this._hideMs = hideMs;
        this._onOpen = onOpen ?? (() => {});
        this._onClose = onClose ?? (() => {});
        this._schedule = schedule ?? ((fn, ms) => setTimeout(fn, ms));
        this._cancel = cancel ?? (id => clearTimeout(id));
        this._dwellId = null;
        this._hideId = null;
        this._edgeInside = false;
        this._destroyed = false;
    }

    // 进入右边缘触发条：停留满 dwellMs 后弹出；侧栏已打开时忽略，不碰收起倒计时
    edgeEnter(isOpen) {
        if (this._destroyed || this._edgeInside) return;
        this._edgeInside = true;
        if (isOpen) return;
        this._cancelDwell();
        this._dwellId = this._schedule(() => {
            this._dwellId = null;
            if (this._destroyed) return;
            this._onOpen();
        }, this._dwellMs);
    }

    // 离开右边缘：取消尚未到点的弹出
    edgeLeave() {
        this._edgeInside = false;
        this._cancelDwell();
    }

    // 进入侧栏：取消收起倒计时
    panelEnter() {
        this._cancelHide();
    }

    // 离开侧栏：重新开始 hideMs 倒计时
    panelLeave() {
        if (this._destroyed) return;
        this._cancelHide();
        this._hideId = this._schedule(() => {
            this._hideId = null;
            if (this._destroyed) return;
            this._onClose();
        }, this._hideMs);
    }

    // show/hide 时清掉待触发任务，避免旧回调打断新状态
    cancelAll() {
        this._cancelDwell();
        this._cancelHide();
    }

    destroy() {
        this._destroyed = true;
        this.cancelAll();
    }

    _cancelDwell() {
        if (this._dwellId !== null) {
            this._cancel(this._dwellId);
            this._dwellId = null;
        }
    }

    _cancelHide() {
        if (this._hideId !== null) {
            this._cancel(this._hideId);
            this._hideId = null;
        }
    }
}
