import test from 'node:test';
import assert from 'node:assert/strict';
import { getRedisConfig, createRedisRestClient } from '../server/redis.js';

test('prefers Upstash Marketplace REST environment variables', () => {
  assert.deepEqual(getRedisConfig({
    UPSTASH_REDIS_REST_URL: 'https://redis.example',
    UPSTASH_REDIS_REST_TOKEN: 'token-a',
    KV_REST_API_URL: 'https://legacy.example',
    KV_REST_API_TOKEN: 'token-b',
  }), { url: 'https://redis.example', token: 'token-a' });
});

test('accepts legacy Vercel KV-compatible REST environment variables', () => {
  assert.deepEqual(getRedisConfig({
    KV_REST_API_URL: 'https://legacy.example',
    KV_REST_API_TOKEN: 'token-b',
  }), { url: 'https://legacy.example', token: 'token-b' });
});

test('throws REDIS_CONFIG_MISSING when storage is not connected', () => {
  assert.throws(() => getRedisConfig({}), /REDIS_CONFIG_MISSING/);
});

test('Redis REST client sends commands with bearer token and unwraps result', async () => {
  const calls = [];
  const client = createRedisRestClient({
    url: 'https://redis.example/',
    token: 'secret-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ result: ['OK', 1] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await client.command('PING');
  assert.deepEqual(result, ['OK', 1]);
  assert.equal(calls[0].url, 'https://redis.example');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].options.body), ['PING']);
});
