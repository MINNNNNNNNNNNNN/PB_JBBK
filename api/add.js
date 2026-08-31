import { createRuntimeLotteryService, methodNotAllowed, readJsonBody, sendJson, sendServiceError } from '../server/http.js';

const MAX_ADD_PER_REQUEST = 5000;

function validCount(value) {
  return Number.isInteger(value) && value >= 0;
}

export async function handleAdd(req, res, service) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  if (!body || !validCount(body.add_wins) || !validCount(body.add_blanks)) {
    return sendJson(res, 400, { error: 'INVALID_ADD_COUNTS' });
  }
  const total = body.add_wins + body.add_blanks;
  if (total === 0) return sendJson(res, 400, { error: 'NOTHING_TO_ADD' });
  if (total > MAX_ADD_PER_REQUEST) return sendJson(res, 400, { error: 'ADD_LIMIT_EXCEEDED' });

  try {
    return sendJson(res, 200, await service.add({ add_wins: body.add_wins, add_blanks: body.add_blanks }));
  } catch (error) {
    return sendServiceError(res, error);
  }
}

export default async function handler(req, res) {
  try {
    return await handleAdd(req, res, createRuntimeLotteryService());
  } catch (error) {
    return sendServiceError(res, error);
  }
}
