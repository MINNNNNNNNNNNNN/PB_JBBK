import test from 'node:test';
import assert from 'node:assert/strict';
import { createLotteryApiClient } from '../public/api-client.mjs';

test('browser client calls only same-origin Vercel API routes', async () => {
  const calls = [];
  const client = createLotteryApiClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ remaining_count: 100 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.state();
  await client.draw();
  await client.confirm('token');
  await client.add({ add_wins: 1, add_blanks: 2 });
  assert.deepEqual(calls.map((call) => call.url), ['/api/state', '/api/draw', '/api/confirm', '/api/add']);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.method, 'POST');
});

test('browser client surfaces API error code', async () => {
  const client = createLotteryApiClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: 'DRAW_IN_PROGRESS' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }),
  });
  await assert.rejects(client.draw(), /DRAW_IN_PROGRESS/);
});
