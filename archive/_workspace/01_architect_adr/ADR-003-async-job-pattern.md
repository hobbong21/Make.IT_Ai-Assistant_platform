# ADR-003 — Async job pattern for long AI calls

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: architect, ai-engineer and backend-engineer consulted
- **Supersedes**: —

## Context

AI operations have very different latency profiles:

| Operation | Typical latency |
|---|---|
| Claude Haiku text (chat reply) | 1–4 s |
| Claude Haiku NLP analyze (short text) | 2–6 s |
| Claude Sonnet deep analysis | 6–15 s |
| Titan Image G1 / SDXL generation | 10–45 s |
| YouTube comments fetch + classify (2k comments) | 30–90 s |
| Review analysis over 5k reviews | 60–180 s |

A single response-model forces the worst operation to dictate the HTTP read timeout on the client and ties up server threads. We must pick per-operation response patterns for:

1. **Sync request/response** (blocking HTTP)
2. **Async job + polling** (`202` + `GET /jobs/{id}`)
3. **Server-Sent Events** (chunked `text/event-stream`)
4. **WebSocket**

## Decision

Adopt a **three-mode policy** keyed to expected latency:

| Latency bucket | Mode | Endpoints |
|---|---|---|
| < 10 s (p95) | **Sync** HTTP | `POST /api/data/nlp/analyze`, `POST /api/data/url/analyze`, `POST /api/data/youtube/influence`, `POST /api/data/youtube/keyword-search`, `POST /api/commerce/chatbot/message`, `POST /api/commerce/reviews/{id}/analyze` (when review count is small), `POST /api/marketing/feed/generate` (text only), `POST /api/marketing/image/remove-bg` |
| 10–180 s, non-streaming | **Async 202 + polling** | `POST /api/commerce/modelshot/generate`, `POST /api/marketing/feed/generate?includeImage=true`, `POST /api/data/youtube/comments` (when `async=true` or maxComments>500), `POST /api/commerce/reviews/{id}/analyze` (large products) |
| Token-level streaming | **SSE** | `POST /api/commerce/chatbot/stream` only |

**Rejected: WebSocket** for v1. See alternatives.

### Async contract

- Server validates input, persists `JobExecution(status=PENDING)`, schedules work on a virtual thread, returns:
  ```json
  { "jobId": "uuid", "statusUrl": "/api/{domain}/jobs/{jobId}", "status": "PENDING" }
  ```
  with HTTP **202**.
- Client polls `GET /api/{domain}/jobs/{jobId}` every 2 s (recommended) up to `Retry-After: 2`.
- Terminal statuses: `SUCCESS` (with `result` JSONB) or `FAILED` (with `errorMessage`).
- `JobExecution` row is persisted before the worker starts, so a pod crash leaves an auditable record.

### SSE contract

- `POST /api/commerce/chatbot/stream` returns `Content-Type: text/event-stream`.
- Events:
  - `event: delta\ndata: "token fragment"`
  - `event: citation\ndata: {"documentId":"...","chunkIndex":3,"score":0.82,"snippet":"..."}`
  - `event: done\ndata: {"tokensIn":120,"tokensOut":340}`
  - `event: error\ndata: "message"`
- Heartbeat: `event: ping` every 15 s to keep proxies from closing.
- Chat message and stream share the same `ChatbotEngine` implementation under the hood.

### Queue choice (v1)

In-process bounded `ArrayBlockingQueue(256)` consumed by a virtual-thread executor. Overflow returns `429` with `Retry-After`. v2 swaps to SQS. The `JobExecution` row is the authoritative state in both cases — no contract change required.

## Consequences

Positive:
- Simple clients: the existing FE fetch-based patterns already work for sync; async just adds a polling loop.
- No new infrastructure for v1 (no SQS, no message broker).
- SSE works over plain HTTP/1.1 and through most proxies — no special ops.
- Jobs are durable records, queryable for support and metrics.

Negative:
- In-process queue means a pod crash loses in-flight (but not persisted result) work. Recovery: a startup sweep marks `RUNNING` rows older than 5 minutes as `FAILED` with `errorMessage=RESTART_RECOVERY`.
- Polling wastes a tiny amount of bandwidth compared to push. Acceptable for v1 volumes.
- SSE is one-way; bi-directional interactivity in chat (stop, regenerate) needs a second REST call. Acceptable.

## Alternatives considered

**Everything sync** — rejected. 45 s image calls would consume client read timeouts and saturate server threads at low concurrency.

**Everything async (202 even for 2 s calls)** — rejected. Doubles round-trips for NLP and chat replies, breaks the FE's current expectation of an immediate JSON body.

**WebSocket for chatbot** — rejected for v1. Operational overhead (sticky sessions, upgrade handling, proxy config) is not justified when SSE gives us token streaming and one-way push which is all the UX needs. v2 reconsider if multi-party chat or live-typing indicators are added.

**SQS from day one** — rejected for v1. Adds cost, IAM config, and a failure mode (message lost before DB insert) we don't need at this scale. The interface (`JobExecution` persistence first, then enqueue) is already SQS-compatible.

## Metrics to watch

- `makit.job.status{status=FAILED}` — failure rate per operation.
- `makit.job.duration_ms{operation=...}` — SLO per endpoint.
- `makit.queue.depth` — early saturation warning.
- `makit.sse.connections.active` — chatbot fan-out.

## Timeouts (must match across layers)

| Layer | Sync endpoints | Async submit | Async poll | SSE |
|---|---|---|---|---|
| Client read | 60 s | 5 s | 5 s | infinite (stream) |
| Server processing budget | 30 s | 1 s | 1 s | heartbeat 15 s |
| Bedrock call timeout | 30 s (text) / 90 s (image) | N/A at submit | N/A | 30 s per chunk window |

If an AI call exceeds its Bedrock timeout, we return a `504`-mapped `ApiErrorResponse{errorCode: AI_BEDROCK_TIMEOUT}` for sync endpoints or transition the job to `FAILED` for async.
