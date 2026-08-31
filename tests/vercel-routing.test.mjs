import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('vercel config explicitly serves index.html at the root path', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(config.rewrites), 'rewrites must be defined');
  assert.ok(
    config.rewrites.some((rule) => rule.source === '/' && rule.destination === '/index.html'),
    'root path must rewrite to /index.html',
  );
});
