import crypto from 'node:crypto';
import { INITIALIZE_SCRIPT, DRAW_SCRIPT, CONFIRM_SCRIPT, ADD_SCRIPT } from './scripts.js';

const INITIAL_WINS = 2;
const INITIAL_BLANKS = 98;
const DRAW_LOCK_TTL_SECONDS = 90;

export class LotteryError extends Error {
  constructor(code, cause) {
    super(code, cause ? { cause } : undefined);
    this.name = 'LotteryError';
    this.code = code;
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roomKeys(room) {
  const prefix = `pb:jbbk:${room}`;
  return {
    state: `${prefix}:state`,
    deck: `${prefix}:deck`,
    drawing: `${prefix}:drawing`,
    history: `${prefix}:history`,
  };
}

function sharedState(raw) {
  return {
    remaining_count: toNumber(raw[0]),
    remaining_wins: toNumber(raw[1]),
    is_drawing: toNumber(raw[2]) === 1,
    version: toNumber(raw[3]),
  };
}

function ensureOk(raw) {
  if (!Array.isArray(raw)) throw new LotteryError('BACKEND_UNAVAILABLE');
  if (raw[0] === 'ERR') throw new LotteryError(String(raw[1] || 'BACKEND_UNAVAILABLE'));
  if (raw[0] !== 'OK') throw new LotteryError('BACKEND_UNAVAILABLE');
  return raw;
}

function defaultSeed() {
  return crypto.randomInt(1, 2147483646);
}

export function createLotteryService({
  redis,
  room = 'main',
  randomUUID = () => crypto.randomUUID(),
  now = () => Date.now(),
  seed = defaultSeed,
} = {}) {
  if (!redis?.eval) throw new LotteryError('REDIS_CONFIG_MISSING');
  const keys = roomKeys(room);

  return {
    async state() {
      try {
        const raw = await redis.eval(
          INITIALIZE_SCRIPT,
          [keys.state, keys.deck, keys.drawing],
          [INITIAL_WINS, INITIAL_BLANKS, seed()],
        );
        if (!Array.isArray(raw)) throw new LotteryError('BACKEND_UNAVAILABLE');
        return sharedState(raw);
      } catch (error) {
        if (error instanceof LotteryError) throw error;
        throw new LotteryError(error?.code === 'REDIS_CONFIG_MISSING' ? 'REDIS_CONFIG_MISSING' : 'BACKEND_UNAVAILABLE', error);
      }
    },

    async draw() {
      const drawToken = randomUUID();
      try {
        const raw = ensureOk(await redis.eval(
          DRAW_SCRIPT,
          [keys.state, keys.deck, keys.drawing, keys.history],
          [drawToken, DRAW_LOCK_TTL_SECONDS, now()],
        ));
        return {
          draw_token: drawToken,
          result: String(raw[1]),
          remaining_count: toNumber(raw[2]),
          remaining_wins: toNumber(raw[3]),
          is_drawing: true,
          version: toNumber(raw[4]),
        };
      } catch (error) {
        if (error instanceof LotteryError) throw error;
        throw new LotteryError(error?.code === 'REDIS_CONFIG_MISSING' ? 'REDIS_CONFIG_MISSING' : 'BACKEND_UNAVAILABLE', error);
      }
    },

    async confirm(drawToken) {
      try {
        const raw = ensureOk(await redis.eval(
          CONFIRM_SCRIPT,
          [keys.state, keys.deck, keys.drawing],
          [drawToken],
        ));
        return sharedState(raw.slice(1));
      } catch (error) {
        if (error instanceof LotteryError) throw error;
        throw new LotteryError(error?.code === 'REDIS_CONFIG_MISSING' ? 'REDIS_CONFIG_MISSING' : 'BACKEND_UNAVAILABLE', error);
      }
    },

    async add({ add_wins, add_blanks }) {
      try {
        const raw = ensureOk(await redis.eval(
          ADD_SCRIPT,
          [keys.state, keys.deck, keys.drawing],
          [add_wins, add_blanks, seed()],
        ));
        return sharedState(raw.slice(1));
      } catch (error) {
        if (error instanceof LotteryError) throw error;
        throw new LotteryError(error?.code === 'REDIS_CONFIG_MISSING' ? 'REDIS_CONFIG_MISSING' : 'BACKEND_UNAVAILABLE', error);
      }
    },
  };
}
