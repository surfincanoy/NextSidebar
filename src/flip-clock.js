// 翻页时钟：时分 4 位、24 小时制，用 Clutter 原生 3D 属性做真实翻页。
// St 的 CSS 引擎不支持 perspective / rotateX，必须驱动 actor 的 rotation_angle_x。
// 背面剔除也不可用，故每段只转 90°（翻到侧立即止），用两片拼出一次翻页。
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import { flipChanges } from './flip-clock-digits.js';

const DIGIT_W = 54;   // 单字宽
const HALF_H = 42;    // 上半片 / 下半片各自的高度
const FLIP_MS = 150;  // 单段翻页时长，两段合计 300ms，在 1 秒 tick 内跑完
// 真机截图像素测量：y_align=CENTER 后字形中心比页片中缝低 5.5px
// （上留白16px、下留白5px）。统一上移该量，上下留白各 10.5px 对称。
const GLYPH_NUDGE_Y = 5.5;

// 一个裁剪半片：W×HALF_H 的容器里放完整数字 label，靠 y 偏移只露出上半或下半。
// 返回的包装对象暴露 easing / rotation / pivot 的直接读写，供 flip 方法体驱动。
function makeHalf(text, isLower) {
    const box = new St.Widget({
        width: DIGIT_W,
        height: HALF_H,
        clip_to_allocation: true,
        // 上下半各挂底色类：实体页片 + 明度差，配合中缝/铰钉形成翻页卡片观感
        style_class: isLower ? 'ns-flip-half-lower' : 'ns-flip-half-upper',
    });
    const digit = new St.Label({
        text,
        style_class: 'ns-flip-digit',
        width: DIGIT_W,
        height: HALF_H * 2,
        x_align: Clutter.ActorAlign.CENTER,
        y: isLower ? -HALF_H - GLYPH_NUDGE_Y : -GLYPH_NUDGE_Y,
    });
    // St.Label 的文本默认 x/y_align = START（顶部对齐）：84px 字号贴顶会让字形
    // 中心高于中缝，整块看起来偏上。显式双向居中，字形中心才落在页片中缝上。
    digit.clutter_text.x_align = Clutter.ActorAlign.CENTER;
    digit.clutter_text.y_align = Clutter.ActorAlign.CENTER;
    box.add_child(digit);
    return {
        box,
        setText(value) { digit.text = value; },
        setOpacity(value) { box.opacity = value; },
        save_easing_state() { box.save_easing_state(); },
        set_easing_duration(ms) { box.set_easing_duration(ms); },
        set_easing_mode(mode) { box.set_easing_mode(mode); },
        restore_easing_state() { box.restore_easing_state(); },
        get rotation_angle_x() { return box.rotation_angle_x; },
        set rotation_angle_x(value) { box.rotation_angle_x = value; },
        // GNOME 51 的 GJS 不再暴露 Clutter.Point 构造器，必须用 actor 方法设置 pivot
        set_pivot_point(x, y) { box.set_pivot_point(x, y); },
    };
}

// 单个数字位：静态上下两片 + fold / unfold 两片动画。
class DigitUnit {
    constructor(text) {
        this.actor = new St.Widget({ width: DIGIT_W, height: HALF_H * 2 });
        this._upperStatic = makeHalf(text, false);
        this._lowerStatic = makeHalf(text, true);
        this._fold = makeHalf(text, false);
        this._unfold = makeHalf(text, true);

        this._upperStatic.box.set_position(0, 0);
        this._lowerStatic.box.set_position(0, HALF_H);
        this._fold.box.set_position(0, 0);
        this._unfold.box.set_position(0, HALF_H);
        // 翻页片静止时隐藏：Clutter 无透视，侧立的 ±90° 片会压成一条线
        // 留在中缝形成残影，所以只在各自动画期间显形，结束立即 setOpacity(0)
        this._fold.set_pivot_point(0.5, 1);
        this._fold.rotation_angle_x = -90;
        this._fold.setOpacity(0);
        this._unfold.set_pivot_point(0.5, 0);
        this._unfold.rotation_angle_x = 90;
        this._unfold.setOpacity(0);
        this._flipTimers = [];

        for (const half of [this._upperStatic, this._lowerStatic, this._fold, this._unfold]) {
            this.actor.add_child(half.box);
        }

        // 机械中缝：黑色分割线 + 上侧高光 + 左右铰钉，让上下半看起来是一张翻页卡片
        const divider = new St.Widget({
            style_class: 'ns-flip-divider', width: DIGIT_W, height: 2,
        });
        divider.set_position(0, HALF_H - 1);
        this.actor.add_child(divider);

        const highlight = new St.Widget({
            style_class: 'ns-flip-divider-hi', width: DIGIT_W, height: 1,
        });
        highlight.set_position(0, HALF_H - 3);
        this.actor.add_child(highlight);

        for (const x of [-3, DIGIT_W - 3]) {
            const hinge = new St.Widget({
                style_class: 'ns-flip-hinge', width: 6, height: 6,
            });
            hinge.set_position(x, HALF_H - 3);
            this.actor.add_child(hinge);
        }
    }

    // 不翻页时直接换数字：初次显示必须调用，否则 label 停在构造时的 '0'
    // 四片一起写，让翻页片也同步到当前值，下次翻页不会残留旧数字
    setText(value) {
        this._upperStatic.setText(value);
        this._lowerStatic.setText(value);
        this._fold.setText(value);
        this._unfold.setText(value);
    }

    // 取消尚未触发的定时器：销毁或同一位快速连续翻页时，旧回调不能再打到新状态/已销毁 actor
    cancelFlip() {
        for (const id of this._flipTimers) GLib.source_remove(id);
        this._flipTimers = [];
    }

    // 释放本单元持有的 actor：外层 FlipClock 销毁 BoxLayout 会连带销毁子节点，
    // 这里显式 destroy 并置空引用，避免 GJS 持有已销毁 actor 的强引用（EGO-L-002/005）。
    destroy() {
        this.cancelFlip();
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
        this._upperStatic = null;
        this._lowerStatic = null;
        this._fold = null;
        this._unfold = null;
    }

    flip(from, to) {
        this.cancelFlip();
        // 经典两段式：上半旧数字先翻下，露出新上半；下半新数字再翻上来盖住旧下半。
        // 静态上半立即换新（被 fold 盖住），静态下半保持旧值到第二段结束才同步。
        this._upperStatic.setText(to);
        this._fold.setText(from);
        this._unfold.setText(to);
        this._fold.set_pivot_point(0.5, 1);
        this._unfold.set_pivot_point(0.5, 0);

        // 第一段：旧上半从 0° 翻到 -90°，显形；结束立即隐藏，避免压扁线残影
        this._fold.rotation_angle_x = 0;
        this._unfold.rotation_angle_x = 90;
        this._fold.setOpacity(255);
        this._fold.save_easing_state();
        this._fold.set_easing_duration(FLIP_MS);
        this._fold.set_easing_mode(Clutter.AnimationMode.EASE_IN_OUT_QUAD);
        this._fold.rotation_angle_x = -90;
        this._fold.restore_easing_state();

        this._flipTimers.push(GLib.timeout_add(GLib.PRIORITY_DEFAULT, FLIP_MS, () => {
            this._fold.setOpacity(0);
            // 第二段：新下半从 90° 翻到 0°，盖住仍显示旧数字的静态下半
            this._unfold.setOpacity(255);
            this._unfold.save_easing_state();
            this._unfold.set_easing_duration(FLIP_MS);
            this._unfold.set_easing_mode(Clutter.AnimationMode.EASE_IN_OUT_QUAD);
            this._unfold.rotation_angle_x = 0;
            this._unfold.restore_easing_state();

            this._flipTimers.push(GLib.timeout_add(GLib.PRIORITY_DEFAULT, FLIP_MS, () => {
                this._lowerStatic.setText(to);
                this._unfold.setOpacity(0);
                return GLib.SOURCE_REMOVE;
            }));
            return GLib.SOURCE_REMOVE;
        }));
    }
}

export class FlipClock {
    constructor() {
        this.actor = new St.BoxLayout({
            style_class: 'ns-flipclock',
            orientation: Clutter.Orientation.HORIZONTAL,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._units = [];
        this._digits = [];
        for (let i = 0; i < 4; i++) {
            if (i === 2) {
                // 冒号比数字单元矮，actor 的 y_align=CENTER 让它在水平盒里垂直居中；
                // 文本自身的 y_align 也居中，避免贴顶让整块时钟看起来偏上
                const colon = new St.Label({
                    text: ':', style_class: 'ns-flip-colon',
                    y_align: Clutter.ActorAlign.CENTER,
                });
                colon.clutter_text.y_align = Clutter.ActorAlign.CENTER;
                // 字形补偿：真机像素显示冒号中心与数字中心同为 y=64，需上移 5.5px。
                // 冒号是水平 BoxLayout 的直接子项且带 y_align=CENTER，布局器会覆盖 y，
                // 所以改用 translation_y（布局后应用，不受布局器分配影响）。
                colon.translation_y = -GLYPH_NUDGE_Y;
                this.actor.add_child(colon);
            }
            const unit = new DigitUnit('0');
            this._units.push(unit);
            this.actor.add_child(unit.actor);
        }
    }

    update(hours, minutes) {
        const changes = flipChanges(this._digits, hours, minutes);
        const next = [];
        for (const change of changes) {
            const unit = this._units[change.index];
            if (change.changed) unit.flip(change.from, change.to);
            else unit.setText(change.to);
            next.push(change.to);
        }
        this._digits = next;
    }

    destroy() {
        for (const unit of this._units ?? []) unit.destroy();
        this._units = [];
        this._digits = [];
        if (this.actor) {
            this.actor.destroy();
            this.actor = null;
        }
    }
}
