import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredIds = ['remainingCount','drawBtn','settingsBtn','ticket','confirmBtn','settingsSheet'];

test('mobile UI contains the required lottery controls and branding', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const id of requiredIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /enactus\.png/);
  assert.match(html, /konkuk-university\.png/);
  assert.match(html, /src=["']\/app\.mjs["']/);
  assert.doesNotMatch(html, /["']\/public\//);
});

test('stylesheet includes the draw animation phases', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  for (const name of ['boxZoom','boxShake','ticketRise','ticketWin']) {
    assert.match(css, new RegExp(`@keyframes\\s+${name}`));
  }
});

test('app uses Vercel API client for draw, confirm, add, and polling with no Supabase references', async () => {
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  const all = [
    app,
    await readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  ].join('\n');
  for (const token of ['api.draw', 'api.confirm', 'api.add', 'startPolling']) assert.match(app, new RegExp(token.replace('.', '\\.')));
  assert.doesNotMatch(all, /supabase/i);
});

test('successful draw releases the busy guard before confirmation', async () => {
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  const successPath = app.slice(app.indexOf('localDraw = payload'), app.indexOf('function revealResult'));
  assert.match(successPath, /busy\s*=\s*false/);
});
