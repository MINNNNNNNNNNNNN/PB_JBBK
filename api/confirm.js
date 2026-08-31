import { createRuntimeLotteryService, methodNotAllowed, readJsonBody, sendJson, sendServiceError } from '../server/http.js';

export async function handleConfirm(req, res, service) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  if (!body || typeof body.draw_token !== 'string' || !body.draw_token.trim()) {
    return sendJson(res, 400, { error: 'INVALID_DRAW_TOKEN' });
  }
  try {
    return sendJson(res, 200, await service.confirm(body.draw_token.trim()));
  } catch (error) {
    return sendServiceError(res, error);
  }
}

export default async function handler(req, res) {
  try {
    return await handleConfirm(req, res, createRuntimeLotteryService());
  } catch (error) {
    return sendServiceError(res, error);
  }
}
