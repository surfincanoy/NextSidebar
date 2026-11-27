// 音频默认流的读取、写入、变化订阅与音量比例换算；音量行和麦克风行共用。
// 真正的音量状态在 PulseAudio 的默认流上，扩展只是众多 GVC 客户端之一：
// 媒体键、GNOME 快捷设置和其他程序都可能改动它，所以必须订阅流的通知。

// 系统允许软件放大时，上限取 GVC 的 get_vol_max_amplified() / get_vol_max_norm()
// （通常是 1.5）；否则固定为 1。数值无效时保守退回 1。
export function volumeLimit(maxNorm, maxAmplified, allowAbove) {
    if (!allowAbove || !Number.isFinite(maxNorm) || maxNorm <= 0 ||
        !Number.isFinite(maxAmplified) || maxAmplified <= maxNorm)
        return 1;
    return maxAmplified / maxNorm;
}

// 流音量相对 100% 的比例，裁剪到当前系统上限（可能大于 1，例如 1.25 → 125%）
export function volumeRatio(stream, maxNorm, limit = 1) {
    return Math.max(0, Math.min(stream.volume / maxNorm, limit));
}

// 图标取未裁剪的真实音量比，与 GNOME Shell 的 getIcon() 一致：
// 即使系统关闭了放大，残留的 >100% 音量仍显示 overamplified 图标。
export function volumeIconName(ratio, muted) {
    if (muted || ratio <= 0) return 'audio-volume-muted-symbolic';
    if (ratio > 1) return 'audio-volume-overamplified-symbolic';
    if (ratio < 0.33) return 'audio-volume-low-symbolic';
    if (ratio < 0.66) return 'audio-volume-medium-symbolic';
    return 'audio-volume-high-symbolic';
}

export function micIconName(ratio, muted) {
    if (muted || ratio <= 0) return 'microphone-sensitivity-muted-symbolic';
    return 'audio-input-microphone-symbolic';
}

export function sliderFraction(ratio, limit) {
    return Math.max(0, Math.min(ratio / limit, 1));
}

export function ratioFromFraction(fraction, limit) {
    return Math.max(0, Math.min(fraction, 1)) * limit;
}

// 显示层：滑块位置用比例，百分比标签用真实音量（因此能显示 100% 以上）
export function sliderDisplay(ratio, limit = 1) {
    return {
        fraction: sliderFraction(ratio, limit),
        percent: Math.round(ratio * 100),
    };
}

// 静音键静音（is_muted 且音量仍 >0）时禁用滑块；音量为 0 时仍可拉起。
export function sliderDisabled(isMuted, volume) {
    return isMuted && volume > 0;
}

// 只写音量值：降到 0 不动静音状态（图标由音量比显示静音），
// 从 0 拉起时顺手清掉可能残留的静音，避免新音量 >0 又被判为静音键静音。
export function setStreamVolume(stream, maxNorm, ratio) {
    const wasZero = stream.volume <= 0;
    stream.volume = ratio * maxNorm;
    if (wasZero && ratio > 0 && stream.is_muted)
        stream.change_is_muted(false);
    stream.push_volume();
}

// 跟踪 mixer 的默认流，订阅其音量与静音变化。
// 默认设备切换、或 mixer 从未就绪变为就绪时，调用 sync() 重新绑定。
export function watchDefaultStream(mixer, changedSignal, getStream, onUpdate) {
    let stream = null;
    let disposed = false;
    const streamIds = [];

    function unbind() {
        for (const [obj, id] of streamIds)
            obj.disconnect(id);
        streamIds.length = 0;
        stream = null;
    }

    function sync() {
        const next = getStream();
        if (next !== stream) {
            unbind();
            stream = next;
            if (stream) {
                for (const signal of ['notify::volume', 'notify::is-muted'])
                    streamIds.push([stream, stream.connect(signal, onUpdate)]);
            }
        }
        onUpdate();
    }

    const mixerId = mixer.connect(changedSignal, sync);
    sync();

    return {
        sync() {
            if (!disposed)
                sync();
        },
        dispose() {
            if (disposed)
                return;
            disposed = true;
            mixer.disconnect(mixerId);
            unbind();
        },
    };
}
