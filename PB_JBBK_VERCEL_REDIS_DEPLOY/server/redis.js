export function getRedisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '';
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '';
  if (!url || !token) {
    const error = new Error('REDIS_CONFIG_MISSING');
    error.code = 'REDIS_CONFIG_MISSING';
    throw error;
  }
  return { url: String(url).replace(/\/+$/, ''), token: String(token) };
}

export function createRedisRestClient({ url, token, fetchImpl = fetch }) {
  const endpoint = String(url || '').replace(/\/+$/, '');
  if (!endpoint || !token) {
    const error = new Error('REDIS_CONFIG_MISSING');
    error.code = 'REDIS_CONFIG_MISSING';
    throw error;
  }

  async function command(...parts) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parts),
        cache: 'no-store',
      });
    } catch (cause) {
      const error = new Error('BACKEND_UNAVAILABLE', { cause });
      error.code = 'BACKEND_UNAVAILABLE';
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch (cause) {
      const error = new Error('BACKEND_UNAVAILABLE', { cause });
      error.code = 'BACKEND_UNAVAILABLE';
      throw error;
    }

    if (!response.ok || payload?.error) {
      const error = new Error('BACKEND_UNAVAILABLE');
      error.code = 'BACKEND_UNAVAILABLE';
      error.status = response.status;
      throw error;
    }

    return payload?.result;
  }

  return {
    command,
    eval(script, keys = [], args = []) {
      return command('EVAL', script, String(keys.length), ...keys, ...args.map((value) => String(value)));
    },
  };
}
