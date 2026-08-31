import { createRuntimeLotteryService, methodNotAllowed, sendJson, sendServiceError } from '../server/http.js';

export async function handleDraw(req, res, service) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    return sendJson(res, 200, await service.draw());
  } catch (error) {
    return sendServiceError(res, error);
  }
}

export default async function handler(req, res) {
  try {
    return await handleDraw(req, res, createRuntimeLotteryService());
  } catch (error) {
    return sendServiceError(res, error);
  }
}
