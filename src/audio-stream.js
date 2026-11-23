// 音频默认流的读取、写入与变化订阅；音量行和麦克风行共用。
// 真正的音量状态在 PulseAudio 的默认流上，扩展只是众多 GVC 客户端之一：
// 媒体键、GNOME 快捷设置和其他程序都可能改动它，所以必须订阅流的通知。

export function volumeRatio(stream, maxNorm) {
    return Math.max(0, Math.min(stream.volume / maxNorm, 1));
}

export function setStreamVolume(stream, maxNorm, ratio, { unmute = true } = {}) {
    if (unmute && stream.is_muted)
        stream.change_is_muted(false);
    stream.volume = ratio * maxNorm;
    stream.push_volume();
}

// 跟踪 mixer 的默认流，订阅其音量与静音变化。
// 默认设备切换、或 mixer 从未就绪变为就绪时，调用 sync() 重新绑定。
export function watchDefaultStream(mixer, changedSignal, getStream, onUpdate) {
    let stream = null;
    let disposed = false;
    const streamIds = [];

    function unbind() {
        for (const [obj, id] of streamIds) {
            try {
                obj.disconnect(id);
            } catch (e) {
                // 流可能已被 Gvc 提前销毁，忽略失效的 signal id
            }
        }
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
            try {
                mixer.disconnect(mixerId);
            } catch (e) {
                // mixer 已关闭时忽略
            }
            unbind();
        },
    };
}
