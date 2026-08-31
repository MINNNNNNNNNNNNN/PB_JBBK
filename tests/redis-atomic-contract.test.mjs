import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIRM_SCRIPT } from '../server/scripts.js';

test('draw Lua script atomically locks and removes exactly one remaining ticket', async () => {
  const source = await readFile(new URL('../server/scripts.js', import.meta.url), 'utf8');
  for (const token of ['DRAW_SCRIPT', "EXISTS", 'LPOP', 'HINCRBY', "SET', drawingKey", "'EX'", 'LPUSH', 'LTRIM']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('add Lua script checks draw lock, preserves history, and reshuffles only remaining plus added tickets', async () => {
  const source = await readFile(new URL('../server/scripts.js', import.meta.url), 'utf8');
  for (const token of ['ADD_SCRIPT', 'LRANGE', 'math.randomseed', 'math.random', "DEL', deckKey", 'RPUSH']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.doesNotMatch(source, /DEL[^\n]*historyKey/i);
});

test('initialization uses an explicit initialized marker so an exhausted deck does not reset', async () => {
  const source = await readFile(new URL('../server/scripts.js', import.meta.url), 'utf8');
  assert.match(source, /HEXISTS[^\n]*initialized/i);
  assert.match(source, /HSET[\s\S]{0,120}initialized/i);
});

test('confirm rejects a stale token after the draw lock expires', () => {
  assert.match(
    CONFIRM_SCRIPT,
    /if not drawingRaw then\s+return \{'ERR', 'DRAW_TOKEN_MISMATCH'\}\s+end/,
  );
});
