import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('metadata 不含已废弃的 version 字段', () => {
    const metadata = JSON.parse(readFileSync(join(root, 'metadata.json'), 'utf8'));

    assert.equal(Object.hasOwn(metadata, 'version'), false);
    assert.equal(metadata.uuid, 'nextsidebar@github.com');
    assert.equal(metadata.url, 'https://github.com/surfincanoy/NextSidebar');
    assert.deepEqual(metadata['shell-version'], ['51']);
});

test('安装脚本会先清掉旧的 src 文件再复制', () => {
    const script = readFileSync(join(root, 'install.sh'), 'utf8');
    const cleanup = script.indexOf('rm -rf "$DEST/src"');
    const copy = script.indexOf('cp src/*.js');

    assert.ok(cleanup >= 0, 'install.sh 缺少 src 目录清理');
    assert.ok(cleanup < copy, '清理必须发生在复制之前');
});

test('仓库包含 GPL-3.0 许可证文本', () => {
    const licensePath = join(root, 'LICENSE');

    assert.equal(existsSync(licensePath), true);
    const text = readFileSync(licensePath, 'utf8');
    assert.match(text, /GNU GENERAL PUBLIC LICENSE/);
    assert.match(text, /Version 3, 29 June 2007/);
});
