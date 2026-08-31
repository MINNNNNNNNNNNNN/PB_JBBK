import { createRuntimeLotteryService, methodNotAllowed, sendJson, sendServiceError } from '../server/http.js';

export async function handleState(req, res, service) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    return sendJson(res, 200, await service.state());
  } catch (error) {
    return sendServiceError(res, error);
  }
}

export default async function handler(req, res) {
  try {
    return await handleState(req, res, createRuntimeLotteryService());
  } catch (error) {
    return sendServiceError(res, error);
  }
}
