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

test('confirmation dismisses the revealed result before restoring the draw controls', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');

  for (const name of ['boxReset', 'ticketDismiss', 'resultDismiss']) {
    assert.match(css, new RegExp(`@keyframes\\s+${name}`));
  }
  assert.match(css, /\.app-shell\.confirming\s+\.box-wrap/);
  assert.match(css, /\.app-shell\.confirming\s+\.ticket/);
  assert.match(css, /\.app-shell\.confirming\s+\.result-panel/);

  const confirmPath = app.slice(app.indexOf('async function confirmDraw'), app.indexOf('function openSettings'));
  assert.match(confirmPath, /classList\.add\(['"]confirming['"]\)/);
  assert.ok(confirmPath.indexOf("classList.add('confirming')") < confirmPath.indexOf('api.confirm'));
  assert.ok(confirmPath.indexOf("classList.remove('show')") < confirmPath.indexOf('api.confirm'));
  assert.ok(confirmPath.indexOf('classList.add(\'confirming\')') < confirmPath.indexOf('resetVisualState()'));
  const exitPath = confirmPath.slice(confirmPath.indexOf('await exitDelay'));
  assert.ok(exitPath.indexOf('await refreshRoom()') > 0);
  assert.ok(exitPath.indexOf('busy = false') > exitPath.indexOf('await refreshRoom()'));
});

test('confirmation button exits faster than the result motion', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.app-shell\.confirming\s+\.confirm-button\s*\{[^}]*transition-duration:\s*\.15s/);
});

test('reduced-motion users do not wait through the visual confirmation delay', async () => {
  const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /matchMedia\?\.\(['"]\(prefers-reduced-motion:\s*reduce\)['"]\)/);
  assert.match(app, /exitDelay\s*=\s*wait\(prefersReducedMotion\s*\?\s*0\s*:\s*CONFIRM_EXIT_MS\)/);
});

test('footer logos retain the larger presentation sizes', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.brand-logo-enactus\s*\{[^}]*height:\s*35px/);
  assert.match(css, /\.brand-logo-konkuk\s*\{[^}]*height:\s*42px/);
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
