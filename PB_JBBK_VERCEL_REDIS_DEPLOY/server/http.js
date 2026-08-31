import { getRedisConfig, createRedisRestClient } from './redis.js';
import { createLotteryService, LotteryError } from './lottery.js';

const PUBLIC_ERROR_CODES = new Set([
  'REDIS_CONFIG_MISSING',
  'BACKEND_UNAVAILABLE',
  'DRAW_IN_PROGRESS',
  'EMPTY_DECK',
  'DRAW_TOKEN_MISMATCH',
  'NOT_INITIALIZED',
]);

export function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}

export function readJsonBody(req) {
  const body = req?.body;
  if (body == null || body === '') return {};
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body));
  } catch {
    return null;
  }
}

export function statusForError(code) {
  if (code === 'DRAW_IN_PROGRESS' || code === 'EMPTY_DECK' || code === 'DRAW_TOKEN_MISMATCH') return 409;
  if (code === 'REDIS_CONFIG_MISSING' || code === 'BACKEND_UNAVAILABLE' || code === 'NOT_INITIALIZED') return 503;
  return 500;
}

export function sendServiceError(res, error) {
  const code = PUBLIC_ERROR_CODES.has(error?.code) ? error.code : 'BACKEND_UNAVAILABLE';
  return sendJson(res, statusForError(code), { error: code });
}

export function createRuntimeLotteryService() {
  try {
    const config = getRedisConfig(process.env);
    const redis = createRedisRestClient(config);
    return createLotteryService({ redis, room: 'main' });
  } catch (error) {
    if (error instanceof LotteryError) throw error;
    throw new LotteryError(error?.code === 'REDIS_CONFIG_MISSING' ? 'REDIS_CONFIG_MISSING' : 'BACKEND_UNAVAILABLE', error);
  }
}
