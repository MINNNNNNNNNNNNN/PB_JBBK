import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotteryService, LotteryError } from '../server/lottery.js';

function fakeRedis(results) {
  const calls = [];
  return {
    calls,
    async eval(script, keys, args) {
      calls.push({ script, keys, args });
      if (!results.length) throw new Error('NO_FAKE_RESULT');
      return results.shift();
    },
  };
}

test('state initializes once and maps shared room state', async () => {
  const redis = fakeRedis([[100, 2, 0, 1]]);
  const service = createLotteryService({ redis, room: 'main', seed: () => 123 });
  assert.deepEqual(await service.state(), {
    remaining_count: 100,
    remaining_wins: 2,
    is_drawing: false,
    version: 1,
  });
  assert.equal(redis.calls.length, 1);
  assert.match(redis.calls[0].keys[0], /pb:jbbk:main:state/);
});

test('draw maps atomic script result and exposes server generated token', async () => {
  const redis = fakeRedis([['OK', 'WIN', 99, 1, 2]]);
  const service = createLotteryService({
    redis,
    randomUUID: () => 'draw-token-1',
    now: () => 1788150000000,
    seed: () => 456,
  });
  assert.deepEqual(await service.draw(), {
    draw_token: 'draw-token-1',
    result: 'WIN',
    remaining_count: 99,
    remaining_wins: 1,
    is_drawing: true,
    version: 2,
  });
  assert.equal(redis.calls[0].args[0], 'draw-token-1');
  assert.equal(redis.calls[0].args[1], 90);
});

test('draw converts Redis domain error to LotteryError', async () => {
  const redis = fakeRedis([['ERR', 'DRAW_IN_PROGRESS']]);
  const service = createLotteryService({ redis, randomUUID: () => 'x' });
  await assert.rejects(service.draw(), (error) => {
    assert.ok(error instanceof LotteryError);
    assert.equal(error.code, 'DRAW_IN_PROGRESS');
    return true;
  });
});

test('confirm and add map returned state', async () => {
  const redis = fakeRedis([
    ['OK', 99, 1, 0, 3],
    ['OK', 104, 3, 0, 4],
  ]);
  const service = createLotteryService({ redis, seed: () => 999 });
  assert.deepEqual(await service.confirm('token-1'), {
    remaining_count: 99,
    remaining_wins: 1,
    is_drawing: false,
    version: 3,
  });
  assert.deepEqual(await service.add({ add_wins: 2, add_blanks: 3 }), {
    remaining_count: 104,
    remaining_wins: 3,
    is_drawing: false,
    version: 4,
  });
});
