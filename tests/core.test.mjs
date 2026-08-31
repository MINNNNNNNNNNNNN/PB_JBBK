import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWinProbability, formatProbability, nextRemaining } from '../public/core.mjs';

test('calculates remaining win probability', () => {
  assert.equal(calculateWinProbability(2, 100), 2);
  assert.equal(calculateWinProbability(1, 4), 25);
});

test('returns zero for an empty deck', () => {
  assert.equal(calculateWinProbability(1, 0), 0);
});

test('formats probability to two decimals', () => {
  assert.equal(formatProbability(2), '2.00%');
  assert.equal(formatProbability(100 / 3), '33.33%');
});

test('never makes remaining count negative', () => {
  assert.equal(nextRemaining(100), 99);
  assert.equal(nextRemaining(0), 0);
});
