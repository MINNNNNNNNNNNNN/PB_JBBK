# Vercel Redis Shared Lottery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with same-origin Vercel Functions backed by Redis while preserving the shared, atomic mobile lottery behavior.

**Architecture:** Static HTML/CSS/ES modules call four `/api/*` Vercel Functions. Functions use a tiny dependency-free Redis REST client, and all mutations execute as atomic Redis Lua scripts.

**Tech Stack:** HTML/CSS/ES modules, Node.js 22+, Vercel Functions, Upstash-compatible Redis REST API, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-vercel-redis-lottery-design.md`

## Global Constraints

- Initial deck is exactly 2 winning + 98 blank tickets.
- Shared state is room `main`.
- No Supabase runtime/configuration remains.
- Redis secrets stay server-side.
- All mutations are atomic Redis `EVAL` scripts.
- Draw lock TTL is 90 seconds.
- Existing mobile visuals and branding remain.
- No external npm runtime dependencies.

---

### Task 1: Redis REST adapter and atomic lottery service

**Files:**
- Create: `server/redis.js`
- Create: `server/scripts.js`
- Create: `server/lottery.js`
- Test: `tests/redis-config.test.mjs`
- Test: `tests/lottery-service.test.mjs`
- Test: `tests/redis-atomic-contract.test.mjs`

**Interfaces:**
- Produces: `getRedisConfig(env)`, `createRedisRestClient(options)`, `createLotteryService({redis, room})`.

- [ ] Write failing tests for env-name compatibility, result mapping, errors, and required atomic Redis commands.
- [ ] Run those tests and verify failure because modules do not exist.
- [ ] Implement minimal Redis REST adapter, scripts, and service mapping.
- [ ] Run task tests and verify they pass.

### Task 2: Vercel HTTP API routes

**Files:**
- Create: `server/http.js`
- Create: `api/state.js`
- Create: `api/draw.js`
- Create: `api/confirm.js`
- Create: `api/add.js`
- Test: `tests/api-handlers.test.mjs`

**Interfaces:**
- Consumes: `createLotteryService()` from Task 1.
- Produces: JSON endpoints `/api/state`, `/api/draw`, `/api/confirm`, `/api/add`.

- [ ] Write failing handler tests for methods, JSON validation, status-code mapping, and `no-store` headers.
- [ ] Run handler tests and verify failure.
- [ ] Implement route handlers with dependency-injectable exported handler functions and Vercel default exports.
- [ ] Run handler tests and verify they pass.

### Task 3: Browser client migration

**Files:**
- Create: `public/api-client.mjs`
- Replace: `public/app.mjs`
- Delete from new package: `public/config.mjs`, `public/supabase-rest.mjs`, `supabase/`
- Modify: `tests/static-ui.test.mjs`
- Create: `tests/api-client.test.mjs`

**Interfaces:**
- Consumes: same-origin `/api/*` routes from Task 2.
- Produces: `createLotteryApiClient()` used by `public/app.mjs`.

- [ ] Write failing tests requiring same-origin API calls and absence of Supabase references.
- [ ] Run tests and verify failure against the pre-migration frontend.
- [ ] Implement API client and migrate the UI flow without changing animation/branding behavior.
- [ ] Run frontend tests and verify pass.

### Task 4: Deployment package and documentation

**Files:**
- Create: `package.json`
- Modify: `README.md`
- Modify: `vercel.json`

**Interfaces:**
- Produces: a GitHub/Vercel-ready source tree and clean ZIP.

- [ ] Add scripts for tests and syntax verification; document Vercel Marketplace Redis setup.
- [ ] Run complete test suite and JavaScript syntax checks.
- [ ] Verify archive root has no `.git`, `supabase/`, or nested absolute-path folders.
- [ ] Build `/mnt/data/PB_JBBK_VERCEL_REDIS.zip` from the clean project root.
