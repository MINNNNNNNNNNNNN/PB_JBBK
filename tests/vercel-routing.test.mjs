import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('vercel publishes the public directory with an index at the root path', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.outputDirectory, 'public');
  const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(index, /<main\b/);
});
