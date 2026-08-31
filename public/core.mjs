export function calculateWinProbability(wins, total) {
  const safeWins = Number.isFinite(wins) ? Math.max(0, wins) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  if (safeTotal === 0) return 0;
  return (safeWins / safeTotal) * 100;
}

export function formatProbability(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)}%`;
}

export function nextRemaining(total) {
  const safe = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  return Math.max(0, safe - 1);
}
