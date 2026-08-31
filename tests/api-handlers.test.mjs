import test from 'node:test';
import assert from 'node:assert/strict';
import { handleState } from '../api/state.js';
import { handleDraw } from '../api/draw.js';
import { handleConfirm } from '../api/confirm.js';
import { handleAdd } from '../api/add.js';
import { LotteryError } from '../server/lottery.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test('GET /api/state returns no-store shared state', async () => {
  const res = responseRecorder();
  await handleState({ method: 'GET' }, res, { state: async () => ({ remaining_count: 100 }) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body, { remaining_count: 100 });
});

test('draw only accepts POST and maps DRAW_IN_PROGRESS to 409', async () => {
  const wrongMethod = responseRecorder();
  await handleDraw({ method: 'GET' }, wrongMethod, { draw: async () => ({}) });
  assert.equal(wrongMethod.statusCode, 405);

  const res = responseRecorder();
  await handleDraw({ method: 'POST' }, res, {
    draw: async () => { throw new LotteryError('DRAW_IN_PROGRESS'); },
  });
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'DRAW_IN_PROGRESS' });
});

test('confirm requires a draw_token', async () => {
  const res = responseRecorder();
  await handleConfirm({ method: 'POST', body: {} }, res, { confirm: async () => ({}) });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'INVALID_DRAW_TOKEN' });
});

test('add validates nonnegative integer counts and caps one request', async () => {
  const invalid = responseRecorder();
  await handleAdd({ method: 'POST', body: { add_wins: -1, add_blanks: 2 } }, invalid, { add: async () => ({}) });
  assert.equal(invalid.statusCode, 400);

  const tooLarge = responseRecorder();
  await handleAdd({ method: 'POST', body: { add_wins: 3000, add_blanks: 3000 } }, tooLarge, { add: async () => ({}) });
  assert.equal(tooLarge.statusCode, 400);
  assert.deepEqual(tooLarge.body, { error: 'ADD_LIMIT_EXCEEDED' });
});

test('storage configuration failures are exposed without secrets', async () => {
  const res = responseRecorder();
  await handleState({ method: 'GET' }, res, {
    state: async () => { throw new LotteryError('REDIS_CONFIG_MISSING'); },
  });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'REDIS_CONFIG_MISSING' });
});

test('default state handler returns 503 when no Redis resource is connected', async () => {
  const { default: stateHandler } = await import('../api/state.js');
  const saved = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  try {
    const res = responseRecorder();
    await stateHandler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: 'REDIS_CONFIG_MISSING' });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
