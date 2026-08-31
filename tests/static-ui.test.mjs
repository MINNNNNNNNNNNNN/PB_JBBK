import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredIds = ['remainingCount','drawBtn','settingsBtn','ticket','confirmBtn','settingsSheet'];

test('mobile UI contains the required lottery controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /viewport/);
  assert.match(html, /public\/styles\.css/);
  assert.match(html, /public\/app\.mjs/);
});

test('stylesheet includes the draw animation phases', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  for (const name of ['boxZoom','boxShake','ticketRise','ticketWin']) {
    assert.match(css, new RegExp(`@keyframes\\s+${name}`));
  }
});

test('app wires Supabase draw, confirm, add, and realtime flow', async () => {
  const js = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  for (const token of ['draw_ticket','confirm_draw','add_tickets','postgres_changes']) {
    assert.match(js, new RegExp(token));
  }
});
