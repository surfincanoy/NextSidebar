import test from 'node:test';
import assert from 'node:assert/strict';
import {
    volumeRatio,
    setStreamVolume,
    watchDefaultStream,
} from '../src/audio-stream.js';

// 测试替身：只实现 GObject 信号与 Gvc.MixerStream 被用到的那几个方法
function makeEmitter() {
    const handlers = new Map();
    let nextId = 1;
    return {
        connect(signal, handler) {
            const id = nextId++;
            handlers.set(id, [signal, handler]);
            return id;
        },
        disconnect(id) {
            // 真实 GObject 对已断开的 signal id 会抛错
            if (!handlers.delete(id))
                throw new Error(`signal ${id} already disconnected`);
        },
        emit(signal) {
            for (const [name, handler] of [...handlers.values()]) {
                if (name === signal)
                    handler(this);
            }
        },
        count(signal) {
            return [...handlers.values()].filter(([name]) => name === signal).length;
        },
        get size() {
            return handlers.size;
        },
    };
}

function makeStream(volume, isMuted = false) {
    const emitter = makeEmitter();
    return Object.assign(emitter, {
        volume,
        is_muted: isMuted,
        pushCount: 0,
        changeMuteCount: 0,
        push_volume() {
            this.pushCount++;
        },
        change_is_muted(value) {
            this.is_muted = value;
            this.changeMuteCount++;
        },
    });
}

function makeMixer(stream) {
    const emitter = makeEmitter();
    return Object.assign(emitter, {
        stream,
        get_default_sink() {
            return this.stream;
        },
        setDefaultStream(next) {
            this.stream = next;
            this.emit('default-sink-changed');
        },
    });
}

test('默认流的音量或静音被外部改动时触发回调', () => {
    const stream = makeStream(32768);
    const mixer = makeMixer(stream);
    let updates = 0;

    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    assert.equal(stream.count('notify::volume'), 1);
    assert.equal(stream.count('notify::is-muted'), 1);

    stream.volume = 49152;
    stream.emit('notify::volume');
    assert.equal(updates, 1);

    stream.is_muted = true;
    stream.emit('notify::is-muted');
    assert.equal(updates, 2);

    watch.dispose();
});

test('默认流切换后改绑新流，旧流不再触发回调', () => {
    const first = makeStream(32768);
    const second = makeStream(16384);
    const mixer = makeMixer(first);
    let updates = 0;

    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    mixer.setDefaultStream(second);
    assert.equal(first.size, 0);
    assert.equal(second.count('notify::volume'), 1);
    assert.equal(second.count('notify::is-muted'), 1);
    assert.equal(updates, 1);

    first.volume = 65536;
    first.emit('notify::volume');
    assert.equal(updates, 1);

    second.volume = 65536;
    second.emit('notify::volume');
    assert.equal(updates, 2);

    watch.dispose();
});

test('sync 在 mixer 变为可用后补绑当时拿到的默认流', () => {
    const mixer = makeMixer(null);
    let updates = 0;
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    const stream = makeStream(32768);
    mixer.stream = stream;
    watch.sync();

    assert.equal(stream.count('notify::volume'), 1);
    assert.equal(updates, 1);

    stream.volume = 65536;
    stream.emit('notify::volume');
    assert.equal(updates, 2);

    watch.dispose();
});

test('dispose 断开 mixer 与当前流的全部连接', () => {
    const stream = makeStream(32768);
    const mixer = makeMixer(stream);
    let updates = 0;
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    watch.dispose();

    assert.equal(mixer.size, 0);
    assert.equal(stream.size, 0);

    stream.volume = 65536;
    stream.emit('notify::volume');
    mixer.emit('default-sink-changed');
    assert.equal(updates, 0);
});

test('volumeRatio 把流音量换算并裁剪到 0–1', () => {
    assert.equal(volumeRatio({ volume: 0 }, 65536), 0);
    assert.equal(volumeRatio({ volume: 32768 }, 65536), 0.5);
    assert.equal(volumeRatio({ volume: 98304 }, 65536), 1);
});

test('setStreamVolume 在静音时先取消静音，再写入音量并推送', () => {
    const stream = makeStream(0, true);

    setStreamVolume(stream, 65536, 0.5);

    assert.equal(stream.is_muted, false);
    assert.equal(stream.changeMuteCount, 1);
    assert.equal(stream.volume, 32768);
    assert.equal(stream.pushCount, 1);
});

test('setStreamVolume 可以保留麦克风原有的静音状态', () => {
    const stream = makeStream(0, true);

    setStreamVolume(stream, 65536, 0.5, { unmute: false });

    assert.equal(stream.is_muted, true);
    assert.equal(stream.changeMuteCount, 0);
    assert.equal(stream.volume, 32768);
    assert.equal(stream.pushCount, 1);
});

test('重复的 sync 不会造成重复订阅', () => {
    const stream = makeStream(32768);
    const mixer = makeMixer(stream);
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => {}
    );

    watch.sync();
    watch.sync();

    assert.equal(stream.count('notify::volume'), 1);
    assert.equal(stream.count('notify::is-muted'), 1);
    watch.dispose();
});

test('默认流消失时解绑旧流，重新出现后再绑定新流', () => {
    const first = makeStream(32768);
    const second = makeStream(16384);
    const mixer = makeMixer(first);
    let updates = 0;
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    mixer.setDefaultStream(null);
    assert.equal(first.size, 0);
    assert.equal(updates, 1);

    mixer.setDefaultStream(second);
    assert.equal(second.count('notify::volume'), 1);
    assert.equal(updates, 2);
    watch.dispose();
});

test('切换流后 dispose 断开的是当前流', () => {
    const first = makeStream(32768);
    const second = makeStream(16384);
    const mixer = makeMixer(first);
    let updates = 0;
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => updates++
    );
    updates = 0;

    mixer.setDefaultStream(second);
    watch.dispose();

    assert.equal(mixer.size, 0);
    assert.equal(first.size, 0);
    assert.equal(second.size, 0);
    second.volume = 65536;
    second.emit('notify::volume');
    assert.equal(updates, 1);
});

test('dispose 可以重复调用而不抛错', () => {
    const stream = makeStream(32768);
    const mixer = makeMixer(stream);
    const watch = watchDefaultStream(
        mixer, 'default-sink-changed', () => mixer.get_default_sink(), () => {}
    );

    watch.dispose();
    assert.doesNotThrow(() => watch.dispose());
    assert.doesNotThrow(() => watch.dispose());
});
