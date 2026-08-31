# Mobile Lottery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first shared lottery web app with 2 winning tickets and 98 blanks, animated one-ticket draws, realtime shared state, and ticket-add settings.

**Architecture:** Serve a dependency-light static frontend from Vercel and expose one tiny Vercel serverless config endpoint for Supabase public configuration. Supabase stores the authoritative shuffled deck and provides atomic RPCs for draw/add operations; clients subscribe to the room row through Realtime.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node.js built-in test runner, Vercel Functions, Supabase Postgres/RPC/Realtime.

**Spec:** `docs/superpowers/specs/2026-08-31-mobile-lottery-design.md`

## Global Constraints

- Mobile-first for 360–430 px screens.
- One shared link; no login, names, or participant registration.
- Initial deck: 2 winning tickets + 98 blanks.
- Server owns the deck order; clients never receive unrevealed ticket values.
- Draw must be atomic under concurrent taps.
- Main screen shows remaining ticket count and one draw button.
- Draw animation: box zoom, shake, ticket rises, result reveals, confirmation fades in.
- Settings are opened from the top-right gear and only add winning/blank tickets.
- Adding tickets reshuffles only the remaining deck plus additions; drawn history is unchanged.
- No npm runtime dependency is required for frontend deployment.

---

### Task 1: Core probability and display helpers
**Files:** Create `public/core.mjs`; Test `tests/core.test.mjs`.
**Interfaces:** Produces `calculateWinProbability(wins,total)`, `formatProbability(value)`, `nextRemaining(total)`.
- [ ] Write failing tests for probability edge cases and formatting.
- [ ] Run `node --test tests/core.test.mjs` and verify failure due to missing module.
- [ ] Implement minimal helpers.
- [ ] Re-run and verify pass.

### Task 2: Vercel Supabase config endpoint
**Files:** Create `api/config.js`; Test `tests/config-api.test.mjs`.
**Interfaces:** GET returns `{supabaseUrl,supabaseAnonKey}` or 500 with `{error}` when env is missing.
- [ ] Write failing handler tests.
- [ ] Verify failure.
- [ ] Implement endpoint.
- [ ] Verify pass.

### Task 3: Mobile UI and animation flow
**Files:** Create `index.html`, `public/styles.css`, `public/app.mjs`; Test `tests/static-ui.test.mjs`.
**Interfaces:** DOM ids `remainingCount`, `drawBtn`, `settingsBtn`, `ticket`, `confirmBtn`, `settingsSheet`.
- [ ] Write failing static contract test.
- [ ] Verify failure.
- [ ] Implement mobile-first markup/styles and state flow.
- [ ] Verify static test pass.

### Task 4: Supabase authoritative deck and RPCs
**Files:** Create `supabase/schema.sql`; Test `tests/schema-contract.test.mjs`.
**Interfaces:** RPCs `draw_ticket(room_slug text)`, `add_tickets(room_slug text, add_wins int, add_blanks int)`, room slug `main`.
- [ ] Write failing SQL contract test.
- [ ] Verify failure.
- [ ] Implement schema, seed, RLS policies, RPCs, realtime publication.
- [ ] Verify contract test pass.

### Task 5: Deployment documentation and final verification
**Files:** Create `README.md`, `vercel.json`, `.gitignore`.
- [ ] Document Supabase SQL setup and Vercel env vars.
- [ ] Run `node --test tests/*.test.mjs`.
- [ ] Run syntax checks on JS modules.
- [ ] Inspect git diff/status and remote.
