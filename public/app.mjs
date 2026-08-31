import { calculateWinProbability, formatProbability } from './core.mjs';

const ROOM_SLUG = 'main';
const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const DRAW_REVEAL_MS = 1750;
const CONFIRM_FADE_DELAY_MS = 450;

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

let supabase;
let realtimeChannel;
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
  dom.draw.disabled = busy || remoteDrawing || empty || !supabase;
  if (!supabase) dom.draw.textContent = '연결 중...';
  else if (remoteDrawing) dom.draw.textContent = '다른 기기에서 추첨 중...';
  else if (empty) dom.draw.textContent = '남은 제비 없음';
  else dom.draw.textContent = '제비 뽑기';
}

function resetVisualState() {
  dom.shell.classList.remove('drawing', 'revealed', 'winner');
  dom.ticket.classList.add('hidden-ticket');
  dom.ticket.setAttribute('aria-hidden', 'true');
  dom.ticketText.textContent = '?';
  dom.result.innerHTML = '';
  dom.confirm.classList.remove('show');
  dom.draw.classList.remove('draw-hidden');
}

async function startDraw() {
  if (busy || !supabase || roomState.is_drawing || roomState.remaining_count <= 0) return;
  busy = true;
  renderControls();

  const { data, error } = await supabase.rpc('draw_ticket', { room_slug: ROOM_SLUG });
  const payload = Array.isArray(data) ? data[0] : data;
  if (error || !payload) {
    busy = false;
    if (error?.message?.includes('DRAW_IN_PROGRESS')) showToast('다른 기기에서 먼저 뽑고 있어요.');
    else if (error?.message?.includes('EMPTY_DECK')) showToast('남은 제비가 없어요.');
    else showToast('추첨에 실패했습니다. 다시 시도해 주세요.');
    await refreshRoom();
    return;
  }

  localDraw = payload;
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
  const { data, error } = await supabase.rpc('confirm_draw', {
    room_slug: ROOM_SLUG,
    draw_token: localDraw.draw_token,
  });

  if (error) {
    showToast('확인 처리에 실패했습니다. 다시 눌러 주세요.');
    busy = false;
    dom.confirm.disabled = false;
    return;
  }

  localDraw = null;
  busy = false;
  dom.confirm.disabled = false;
  resetVisualState();
  const payload = Array.isArray(data) ? data[0] : data;
  if (payload) applyRoomState(payload);
  else await refreshRoom();
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
  if (!supabase || busy || addWins + addBlanks === 0) return;
  const confirmed = window.confirm(`당첨 ${addWins}개, 꽝 ${addBlanks}개를 추가할까요?`);
  if (!confirmed) return;

  busy = true;
  renderAddPreview();
  renderControls();
  const { data, error } = await supabase.rpc('add_tickets', {
    room_slug: ROOM_SLUG,
    add_wins: addWins,
    add_blanks: addBlanks,
  });

  busy = false;
  if (error) {
    showToast(error.message?.includes('DRAW_IN_PROGRESS') ? '추첨 중에는 제비를 추가할 수 없어요.' : '제비 추가에 실패했습니다.');
    renderAddPreview();
    renderControls();
    return;
  }

  const totalAdded = addWins + addBlanks;
  addWins = 0;
  addBlanks = 0;
  const payload = Array.isArray(data) ? data[0] : data;
  if (payload) applyRoomState(payload);
  closeSettings();
  showToast(`${totalAdded}개를 추가하고 다시 섞었습니다.`);
}

async function refreshRoom() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('lottery_rooms')
    .select('slug,remaining_count,remaining_wins,is_drawing,draw_expires_at,version')
    .eq('slug', ROOM_SLUG)
    .single();
  if (!error && data) applyRoomState(data);
}

async function connectRealtime() {
  realtimeChannel = supabase
    .channel(`lottery-room-${ROOM_SLUG}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'lottery_rooms',
      filter: `slug=eq.${ROOM_SLUG}`,
    }, (payload) => applyRoomState(payload.new))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') setConnection('실시간 연결', false);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('재연결 중', true);
    });
}

async function bootstrap() {
  try {
    setConnection('연결 중', true);
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('CONFIG');
    const { supabaseUrl, supabaseAnonKey } = await configResponse.json();
    const { createClient } = await import(SUPABASE_ESM);
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await refreshRoom();
    await connectRealtime();
    dom.settings.disabled = false;
    setConnection('실시간 연결', false);
    renderControls();
  } catch (error) {
    console.error(error);
    setConnection('설정 필요', true);
    dom.draw.textContent = '연결 설정 필요';
    dom.draw.disabled = true;
    dom.settings.disabled = true;
    showToast('Vercel 환경변수와 Supabase 설정을 확인해 주세요.');
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
window.addEventListener('beforeunload', () => { if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel); });

resetVisualState();
renderControls();
bootstrap();
