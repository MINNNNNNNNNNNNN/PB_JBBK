import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/config.js';

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('returns public Supabase config from environment', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test';

  const res = makeRes();
  handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-test'
  });

  process.env.SUPABASE_URL = oldUrl;
  process.env.SUPABASE_ANON_KEY = oldKey;
});

test('returns 500 when configuration is missing', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  const res = makeRes();
  handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'SUPABASE_CONFIG_MISSING');

  process.env.SUPABASE_URL = oldUrl;
  process.env.SUPABASE_ANON_KEY = oldKey;
});
