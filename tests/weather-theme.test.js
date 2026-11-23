import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFromXiaomi } from '../src/weather-theme.js';

test('异常天气码不会命中对象原型链', () => {
    assert.equal(categoryFromXiaomi('constructor'), 'overcast');
    assert.equal(categoryFromXiaomi('__proto__'), 'overcast');
    assert.equal(categoryFromXiaomi('toString'), 'overcast');
});

test('正常天气码仍能正确分类', () => {
    assert.equal(categoryFromXiaomi('0'), 'clear');
    assert.equal(categoryFromXiaomi('10'), 'rain');
    assert.equal(categoryFromXiaomi('53'), 'haze');
    assert.equal(categoryFromXiaomi('unexpected'), 'overcast');
});
