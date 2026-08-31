import { calculateWinProbability, formatProbability } from './core.mjs';
import { createLotteryApiClient } from './api-client.mjs';

const POLL_INTERVAL_MS = 1000;
const DRAW_REVEAL_MS = 1750;
const CONFIRM_FADE_DELAY_MS = 450;
const CONFIRM_EXIT_MS = 420;

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));
const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

const dom = {
  shell: document.getElementById('appShell'),
  remaining: document.getElementById('remainingCount'),
  draw: document.getElementById('drawBtn'),
  settings: document.getElementById('settingsBtn'),
  ticket: document.getElementById('ticket'),
  ticketText: document.getElementById('ticketText'),
  confirm: document.getElementById('confirmBtn'),
  result: document.getElementById('resultPanel'),
  connection: document.getElementById('connectionState'),
  backdrop: document.getElementById('sheetBackdrop'),
  closeSettings: document.getElementById('closeSettingsBtn'),
  winAdd: document.getElementById('winAdd'),
  blankAdd: document.getElementById('blankAdd'),
  addPreview: document.getElementById('addPreview'),
  addTickets: document.getElementById('addTicketsBtn'),
  toast: document.getElementById('toast'),
  winPlus: document.getElementById('winPlus'),
  winMinus: document.getElementById('winMinus'),
  blankPlus: document.getElementById('blankPlus'),
  blankMinus: document.getElementById('blankMinus'),
};

const api = createLotteryApiClient();
let connected = false;
let pollTimer;
let roomState = { remaining_count: 100, remaining_wins: 2, is_drawing: false, version: 0 };
let addWins = 0;
let addBlanks = 0;
let localDraw = null;
let busy = false;

function setConnection(label, visible = true) {
  dom.connection.textContent = label;
  dom.connection.classList.toggle('visible', visible);
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => dom.toast.classList.remove('show'), 1600);
}

function applyRoomState(next) {
  roomState = { ...roomState, ...next };
  dom.remaining.textContent = roomState.remaining_count;
  renderControls();
  renderAddPreview();
}

function renderControls() {
  const remoteDrawing = roomState.is_drawing && !localDraw;
  const empty = roomState.remaining_count <= 0;
  dom.settings.disabled = busy || roomState.is_drawing;
  dom.draw.disabled = busy || remoteDrawing || empty || !connected;
  if (!connected) dom.draw.textContent = '연결 중...';
  else if (remoteDrawing) dom.draw.textContent = '다른 기기에서 추첨 중...';
  else if (empty) dom.draw.textContent = '남은 제비 없음';
  else dom.draw.textContent = '제비 뽑기';
}

function resetVisualState() {
  dom.shell.classList.remove('drawing', 'revealed', 'winner', 'confirming');
  dom.ticket.classList.add('hidden-ticket');
  dom.ticket.setAttribute('aria-hidden', 'true');
  dom.ticketText.textContent = '?';
  dom.result.innerHTML = '';
  dom.confirm.classList.remove('show');
  dom.draw.classList.remove('draw-hidden');
}

async function startDraw() {
  if (busy || !connected || roomState.is_drawing || roomState.remaining_count <= 0) return;
  busy = true;
  renderControls();

  let payload;
  try {
    payload = await api.draw();
  } catch (error) {
    busy = false;
    if (error?.code === 'DRAW_IN_PROGRESS') showToast('다른 기기에서 먼저 뽑고 있어요.');
    else if (error?.code === 'EMPTY_DECK') showToast('남은 제비가 없어요.');
    else showToast(`추첨 실패: ${error?.message || '연결 오류'}`);
    await refreshRoom();
    return;
  }
  if (!payload) {
    busy = false;
    showToast('추첨 결과를 받지 못했습니다.');
    await refreshRoom();
    return;
  }

  localDraw = payload;
  busy = false;
  applyRoomState({
    remaining_count: payload.remaining_count,
    remaining_wins: payload.remaining_wins,
    is_drawing: true,
    version: payload.version,
  });

  dom.draw.classList.add('draw-hidden');
  dom.confirm.classList.remove('show');
  dom.result.innerHTML = '';
  dom.ticket.classList.add('hidden-ticket');
  dom.ticketText.textContent = '?';
  dom.ticket.setAttribute('aria-hidden', 'true');
  dom.shell.classList.remove('revealed', 'winner');
  void dom.shell.offsetWidth;
  dom.shell.classList.add('drawing');

  window.setTimeout(() => revealResult(payload), DRAW_REVEAL_MS);
}

function revealResult(payload) {
  const isWin = payload.result === 'WIN';
  dom.ticketText.textContent = isWin ? '당첨 🎉' : '꽝';
  dom.ticket.classList.remove('hidden-ticket');
  dom.ticket.setAttribute('aria-hidden', 'false');
  dom.shell.classList.add('revealed');
  if (isWin) dom.shell.classList.add('winner');

  const probability = calculateWinProbability(payload.remaining_wins, payload.remaining_count);
  dom.result.innerHTML = `
    <div class="result-title">${isWin ? '당첨 🎉' : '꽝'}</div>
    <div>남은 제비 ${payload.remaining_count}개 · 남은 당첨 ${payload.remaining_wins}개</div>
    <div>다음 당첨 확률 ${formatProbability(probability)}</div>
  `;
  window.setTimeout(() => dom.confirm.classList.add('show'), CONFIRM_FADE_DELAY_MS);
}

async function confirmDraw() {
  if (!localDraw || busy) return;
  busy = true;
  dom.confirm.disabled = true;
  let data;
  try {
    data = await api.confirm(localDraw.draw_token);
  } catch (error) {
    showToast(`확인 실패: ${error?.message || '연결 오류'}`);
    busy = false;
    dom.confirm.disabled = false;
    return;
  }

  localDraw = null;
  dom.shell.classList.add('confirming');
  dom.confirm.classList.remove('show');
  await wait(prefersReducedMotion ? 0 : CONFIRM_EXIT_MS);
  resetVisualState();
  if (data) applyRoomState(data);
  try {
    await refreshRoom();
  } catch {
    // refreshRoom already renders a disconnected state; keep the confirmed count as fallback.
  }
  busy = false;
  dom.confirm.disabled = false;
  renderControls();
}

function openSettings() {
  if (roomState.is_drawing || busy) return;
  addWins = 0;
  addBlanks = 0;
  renderAddPreview();
  dom.backdrop.classList.add('open');
  dom.backdrop.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  dom.backdrop.classList.remove('open');
  dom.backdrop.setAttribute('aria-hidden', 'true');
  dom.settings.focus();
}

function renderAddPreview() {
  dom.winAdd.textContent = addWins;
  dom.blankAdd.textContent = addBlanks;
  dom.addPreview.textContent = `추가 후 남은 제비 ${roomState.remaining_count + addWins + addBlanks}개`;
  dom.addTickets.disabled = addWins + addBlanks === 0 || busy;
}

function adjust(kind, delta) {
  if (kind === 'win') addWins = Math.min(999, Math.max(0, addWins + delta));
  else addBlanks = Math.min(9999, Math.max(0, addBlanks + delta));
  renderAddPreview();
}

async function addTickets() {
  if (!connected || busy || addWins + addBlanks === 0) return;
  const confirmed = window.confirm(`당첨 ${addWins}개, 꽝 ${addBlanks}개를 추가할까요?`);
  if (!confirmed) return;

  busy = true;
  renderAddPreview();
  renderControls();
  let data;
  try {
    data = await api.add({ add_wins: addWins, add_blanks: addBlanks });
  } catch (error) {
    busy = false;
    showToast(error?.code === 'DRAW_IN_PROGRESS' ? '추첨 중에는 제비를 추가할 수 없어요.' : `제비 추가 실패: ${error?.message || '연결 오류'}`);
    renderAddPreview();
    renderControls();
    return;
  }

  busy = false;

  const totalAdded = addWins + addBlanks;
  addWins = 0;
  addBlanks = 0;
  const payload = data;
  if (payload) applyRoomState(payload);
  closeSettings();
  showToast(`${totalAdded}개를 추가하고 다시 섞었습니다.`);
}

async function refreshRoom() {
  try {
    const data = await api.state();
    if (!data) throw new Error('ROOM_NOT_FOUND');
    connected = true;
    applyRoomState(data);
    setConnection('연결됨', false);
  } catch (error) {
    connected = false;
    renderControls();
    console.error('ROOM_REFRESH_FAILED', error);
    setConnection(error?.code === 'REDIS_CONFIG_MISSING' ? '저장소 연결 필요' : '연결 오류', true);
    throw error;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = window.setInterval(() => {
    if (!busy && !localDraw) refreshRoom().catch(() => {});
  }, POLL_INTERVAL_MS);
}

async function bootstrap() {
  try {
    setConnection('연결 중', true);
    await refreshRoom();
    startPolling();
    dom.settings.disabled = false;
    renderControls();
  } catch (error) {
    console.error('BOOTSTRAP_FAILED', error);
    connected = false;
    const storageMissing = error?.code === 'REDIS_CONFIG_MISSING';
    setConnection(storageMissing ? '저장소 연결 필요' : '연결 오류', true);
    dom.draw.textContent = storageMissing ? 'Redis 연결 필요' : '서버 연결 오류';
    dom.draw.disabled = true;
    dom.settings.disabled = true;
    showToast(storageMissing ? 'Vercel에서 Redis 저장소를 연결해 주세요.' : '서버 연결에 실패했습니다.');
  }
}

dom.draw.addEventListener('click', startDraw);
dom.confirm.addEventListener('click', confirmDraw);
dom.settings.addEventListener('click', openSettings);
dom.closeSettings.addEventListener('click', closeSettings);
dom.backdrop.addEventListener('click', (event) => { if (event.target === dom.backdrop) closeSettings(); });
dom.winPlus.addEventListener('click', () => adjust('win', 1));
dom.winMinus.addEventListener('click', () => adjust('win', -1));
dom.blankPlus.addEventListener('click', () => adjust('blank', 1));
dom.blankMinus.addEventListener('click', () => adjust('blank', -1));
dom.addTickets.addEventListener('click', addTickets);
window.addEventListener('beforeunload', () => { if (pollTimer) clearInterval(pollTimer); });

resetVisualState();
renderControls();
bootstrap();
