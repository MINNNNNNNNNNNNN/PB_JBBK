# Vercel Redis Shared Lottery Design

## Goal

Replace the Supabase-backed shared lottery with a Vercel-native deployment flow: static frontend + Vercel Functions + a Redis resource provisioned from the Vercel Marketplace. Participants continue to use one public URL and share one deck.

## User-visible behavior

- Initial deck: 100 tickets, 2 `WIN`, 98 `BLANK`.
- No login or name entry.
- Every device sees the same remaining count and draw status.
- A draw is atomic: two concurrent requests cannot receive the same ticket.
- While one device is presenting a draw, other devices show that a draw is in progress.
- Confirm releases the draw lock. A stale lock automatically expires after 90 seconds so one abandoned browser cannot block the room forever.
- Settings can only add winning or blank tickets. Existing draw history is untouched. Remaining tickets plus newly added tickets are reshuffled atomically.
- Existing mobile UI, animation, result probability, Enactus logo, and Konkuk University logo remain.

## Architecture

The browser only talks to same-origin Vercel API routes. It never receives Redis credentials.

- `GET /api/state`: initialize the room once if needed, then return shared state.
- `POST /api/draw`: atomically pop one ticket, update remaining wins/version, create a temporary draw lock, and append history.
- `POST /api/confirm`: release the current draw lock only when the supplied draw token matches.
- `POST /api/add`: while no draw is in progress, atomically read the remaining deck, append tickets, reshuffle, replace the deck, and update counts.

Vercel Functions access Redis through the provider's HTTP REST API. The code accepts both current Upstash Marketplace variable names (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) and legacy Vercel KV-compatible names (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). No npm dependency is required.

## Redis model

Room slug is fixed to `main` for v1. Keys use prefix `pb:jbbk:main`:

- `:deck` — Redis List of `WIN` / `BLANK` remaining tickets.
- `:state` — Redis Hash with `initialized`, `remaining_wins`, and `version`.
- `:drawing` — Redis String JSON payload `{token,result,created_at}` with 90-second TTL.
- `:history` — Redis List of recent draw JSON records, trimmed to the latest 500 entries.

Initialization is guarded by `state.initialized`; an empty fully-consumed deck must never reset to 100 merely because the list is empty.

## Atomicity

All state-changing operations use one Redis `EVAL` script per operation. Redis executes each script atomically. `draw` checks the draw lock and removes one ticket in the same script. `add` checks the lock, appends tickets, shuffles, and replaces the list in one script. `confirm` compares the draw token and deletes the lock in one script.

## Failure handling

- Missing Redis integration -> API returns `503 REDIS_CONFIG_MISSING`; frontend displays `서버 저장소 연결 필요`.
- Another device drawing -> `409 DRAW_IN_PROGRESS`.
- Empty deck -> `409 EMPTY_DECK`.
- Wrong/stale confirmation token -> `409 DRAW_TOKEN_MISMATCH`; frontend clears stale local state after refresh.
- Redis/provider/network failure -> `503 BACKEND_UNAVAILABLE` with no credential details returned to browser.
- Every state response is `Cache-Control: no-store`.

## Security and scope

- Redis credentials stay server-side in Vercel environment variables created by the storage integration.
- No Supabase URL/key or database password is shipped to the browser.
- No admin authentication is added in v1; anyone with the event URL can open the settings sheet, matching the current product behavior.
- No participant identity, analytics, accounts, or persistent personal data is added.

## Verification

- Node unit tests for Redis config, service result mapping, HTTP validation, and frontend API wiring.
- Contract tests assert that draw/add/confirm use atomic Lua scripts and that Supabase references are absent.
- Syntax checks for all frontend and API JavaScript.
- Clean deployment ZIP must contain root `index.html`, `vercel.json`, `package.json`, `api/`, `public/`, `tests/`, and docs; no `.git`, no `supabase/`, and no nested `mnt/data` path.
