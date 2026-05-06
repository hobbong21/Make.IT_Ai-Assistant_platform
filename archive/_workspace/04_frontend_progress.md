# MaKIT — Frontend Progress

**Author**: frontend-engineer agent
**Date**: 2026-04-20
**Status**: In progress (API wiring complete; backend not yet running)

## Overview

Consolidated `/frontend/` as the canonical source. The static HTML/CSS (design
mockup) is untouched; all business logic now lives in `js/` external modules.
Inline business-logic scripts were removed and replaced with `<script src>`
tags. Design (colors, typography, spacing, layout) is unchanged.

## Files created

### JavaScript infrastructure (new)
- `frontend/js/config.js` — runtime config; picks `/api` (Nginx) or `http://localhost:8083/api` (file:// / direct static).
- `frontend/js/api.js` — fetch wrapper with JWT injection, 401 redirect, domain namespaces (`api.auth`, `api.data`, `api.marketing`, `api.commerce`, `api.jobs`). Includes `api.jobs.poll()` for 202-Accepted async endpoints.
- `frontend/js/auth.js` — `isLoggedIn`, `getUser`, `getToken`, `saveSession`, `clearSession`, `requireLogin`.
- `frontend/js/ui.js` — `toast`, `showLoading`, `hideLoading`, `renderError`, `escapeHtml`, `formatDate`.

### Page scripts (new)
- `frontend/js/pages/login.js`
- `frontend/js/pages/index.js`
- `frontend/js/pages/all-services.js`
- `frontend/js/pages/service-detail.js`
- `frontend/js/pages/chatbot.js` (SSE streaming client, used by `service-detail.js` when `?service=chatbot`)

### CSS (new)
- `frontend/css/common.css` — `.is-loading`, `.toast`, `.error-state`, `.makit-noscript`. Additive only.

## Files edited

- `frontend/index.html` — fixed stylesheet path `styles.css` → `css/styles.css`, added `common.css` link, noscript banner, script tags.
- `frontend/intro.html` — added `common.css` link, noscript banner. (No scripts needed.)
- `frontend/login.html` — removed inline `<script>` with hardcoded `http://localhost:8083/api`, replaced with external scripts. Demo accounts UI preserved (the global `fillDemoAccount()` fn is now exported from `login.js`).
- `frontend/all-services.html` — added `common.css` link, replaced inline filter/search script with `pages/all-services.js` (preserves existing behavior, adds card-click navigation to `service-detail.html?service={key}`).
- `frontend/service-detail.html` — added `common.css` link, replaced inline `simulateChat()` demo with `pages/service-detail.js` wiring the 12 example buttons to real API calls. UI (message bubbles, typing indicator, chart placeholder) unchanged.

## Endpoint coverage map

| Page | Triggered API |
|---|---|
| `login.html` | `POST /api/auth/login`, `GET /api/auth/me` (auto-skip-if-logged-in) |
| `index.html` | `GET /api/auth/me` (populates sidebar user slot if present) |
| `all-services.html` | No direct API calls (client-side filter only); requires login |
| `service-detail.html?service=nlp-analyze` | `POST /api/data/nlp/analyze` |
| `service-detail.html?service=youtube-comments` | `POST /api/data/youtube/comments` |
| `service-detail.html?service=youtube-influence` | `POST /api/data/youtube/influence` |
| `service-detail.html?service=youtube-keyword-search` | `POST /api/data/youtube/keyword-search` |
| `service-detail.html?service=url-analyze` | `POST /api/data/url/analyze` |
| `service-detail.html?service=feed-generate` | `POST /api/marketing/feed/generate` |
| `service-detail.html?service=review-analysis` | `POST /api/commerce/reviews/{productId}/analyze` |
| `service-detail.html?service=chatbot` | `POST /api/commerce/chatbot/stream` (SSE) + fallback `POST /api/commerce/chatbot/message` |
| (service-detail) `remove-bg`, `modelshot` | Not wired — require image upload UI not present in current mockup. Friendly placeholder shown. |

## SSE (chatbot) implementation notes

- Uses `fetch().body.getReader()` + `TextDecoder` per SKILL template; no `EventSource` (would not allow `Authorization` header or POST body).
- Splits on `\n\n` (SSE event separator). Parses `event:` and `data:` lines.
- Supported event names: `delta` (append token to message), `citation` (currently ignored), `done` (captures `contextId` for follow-up messages), `error` (displays in the bubble), `ping` (heartbeat, ignored).
- `contextId` is cached in `window.makitChatbot` module state so subsequent messages in the same page lifetime keep conversation continuity. `resetContext()` exposed if needed.
- Falls back to non-streaming `/api/commerce/chatbot/message` if `resp.body.getReader` is not available.
- 401 during streaming clears session and redirects to `login.html` (mirrors `api.js` behavior).

## Error-handling UX

- `api.js` throws `ApiError(status, code, message, details)`.
- Network failures (fetch rejection): `code = 'NETWORK_ERROR'`, message `"서버와 연결할 수 없습니다…"`.
- 401: auto-clear localStorage + redirect to `login.html`.
- `service-detail.js` shows both an in-bubble error block and a toast for transient failures.
- `login.js` distinguishes `NETWORK_ERROR` → "서버 연결에 실패했습니다…" from API errors → shows the server's message.

## Port handling (R3)

- Architect confirmed backend on `:8083` (keeps parity with the old hardcoded login.html URL).
- `config.js` auto-selects `/api` (same-origin via Nginx) or `http://localhost:8083/api` (direct `file://` or static server).
- No absolute API URLs remain anywhere in HTML.

## Known TODOs / dependencies on other agents

- **backend-engineer / devops-engineer**: add CORS origins to whitelist when running FE at a different origin from `:8083`. Suggested: `http://localhost:8080`, `http://localhost:5173`, `file://` not applicable. Architect spec already lists `http://localhost:8080, http://localhost:5173, https://makit.example.com`.
- **backend-engineer**: confirm SSE shape matches `{event, data}` JSON-in-data per OpenAPI spec (architect's `ChatStreamChunk`). Current client also tolerates plain text `data:` lines as a fallback.
- **ai-engineer**: ensure `event: ping` heartbeats are sent at least every 15s so intermediate proxies don't drop the connection.
- **backend-engineer**: the `remove-bg` / `modelshot` endpoints need a file-upload/config UI on the FE — current mockup doesn't include one. Follow-up story needed (out of scope for this round per directive).
- **devops-engineer**: serve `/frontend/` as the document root in Nginx and proxy `/api/*` → `http://backend:8083/api/*` so same-origin routing works without the 8083 fallback.
- **qa-engineer**: login flow uses email+password only; the architect demo accounts (`demo@Human.Ai.D.com`, `marketer@example.com` / password `password123`) need to be seeded in DB.

## Not changed

- `/0. Design1_Mokup/` — archive, preserved as-is.
- Backend, docker-compose, Nginx configs.
- Root-level duplicate HTML/CSS (see `04_frontend_cleanup_notes.md`).
- Design tokens, layout, typography.
