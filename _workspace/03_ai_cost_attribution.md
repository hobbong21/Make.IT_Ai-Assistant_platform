# 03 — Bedrock Cost Attribution per User

**Author**: ai-engineer agent
**Date**: 2026-04-20
**Status**: Live — shipped in Phase 4.x Operations Readiness round.

## Mechanism

`BedrockService` reads `userId` from SLF4J MDC on every recorded metric.
When MDC carries a `userId` (e.g. set by the backend auth filter),
Micrometer counters/summaries gain a `user_id` tag:

| Metric                       | Tags                                                   |
|------------------------------|--------------------------------------------------------|
| `bedrock.tokens.input`       | `model`, `user_id`                                     |
| `bedrock.tokens.output`      | `model`, `user_id`                                     |
| `bedrock.cost.usd`           | `model`, `user_id`                                     |
| `bedrock.invoke` (timer)     | `model`, `operation`, `status`, `tier`, `prompt_version`|
| `bedrock.stream.first-token-ms` | `model`, `user_id`                                 |
| `bedrock.stream.total-ms`    | `model`, `user_id`, `status`                           |

When MDC has no `userId` (scheduled jobs, warmup probes), the tag value is
`system`, so cardinality stays bounded and the time series is still queryable.

Dollar cost is derived from `aws.bedrock.tariff.<modelId>.{inputPer1k, outputPer1k}`
at the point of metric emission — the sum of `bedrock.cost.usd` over a window
is the incurred spend for that window.

## Cardinality hygiene

Tagging by raw `userId` UUID is bounded by WAU; in practice Prometheus handles
100k distinct label values without trouble. If cardinality ever becomes a
concern, the backend auth filter can bucket users (e.g. `company_id` or
`tier`) into the MDC slot before calls — no Bedrock-layer change needed.

## Prometheus examples

Top 10 users by spend in the last hour:

```promql
topk(10,
  sum by (user_id) (
    increase(bedrock_cost_usd_total[1h])
  )
)
```

Average output tokens per call for a given user:

```promql
rate(bedrock_tokens_output_sum{user_id="<uuid>"}[5m])
/
rate(bedrock_tokens_output_count{user_id="<uuid>"}[5m])
```

## CloudWatch Logs Insights

The JSON access log already carries `%X{userId}` in the pattern string
(`application.yml` -> `logging.pattern.console`). When logs ship to CloudWatch
(devops-engineer config), operators can cross-check Prometheus numbers:

```
fields @timestamp, userId, msg
| filter @message like /Bedrock call/
| stats count() as calls,
        sum(tokensIn)  as inTok,
        sum(tokensOut) as outTok
  by userId
| sort calls desc
| limit 25
```

(The backend access filter is expected to emit per-request
`BedrockService` traces with structured `tokensIn`/`tokensOut` fields;
that structured log is owned by backend-engineer.)

## Runbook ties

- **Budget breach**: alert rule on
  `sum(rate(bedrock_cost_usd_total[5m])) > <threshold>`.
  Group-by `user_id` in the notification so ops can see the offending caller.
- **Throttle one user**: MDC-keyed rate limiter on the API gateway side
  (backend-engineer) — this layer only reports, it does not enforce.

## Caveats / TODOs

- `user_id=system` aggregates every MDC-less call; if background jobs
  proliferate, split further by a `job_name` MDC key.
- Cost tariff is editable per-model in `application.yml`. Review quarterly —
  prices change.
