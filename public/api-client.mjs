async function parseJsonResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const code = payload?.error || `HTTP_${response.status}`;
    const error = new Error(code);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function createLotteryApiClient({ fetchImpl = fetch } = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    const options = {
      method,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchImpl(path, options);
    } catch (cause) {
      const error = new Error('BACKEND_UNAVAILABLE', { cause });
      error.code = 'BACKEND_UNAVAILABLE';
      throw error;
    }
    return parseJsonResponse(response);
  }

  return {
    state() {
      return request('/api/state');
    },
    draw() {
      return request('/api/draw', { method: 'POST' });
    },
    confirm(drawToken) {
      return request('/api/confirm', { method: 'POST', body: { draw_token: drawToken } });
    },
    add({ add_wins, add_blanks }) {
      return request('/api/add', { method: 'POST', body: { add_wins, add_blanks } });
    },
  };
}
