# MaKIT SLI/SLO 정의

## 개요

MaKIT 플랫폼의 신뢰도 목표는 **Error Budget** 개념에 기반합니다. 각 기능별 SLO(Service Level Objective)는 허용 가능한 다운타임/에러율을 정의하며, SLI(Service Level Indicator)는 이를 측정하는 지표입니다.

- **SLO**: 목표 신뢰도 (예: 99.9% availability)
- **SLI**: 측정 지표 (예: 성공한 요청 / 전체 요청)
- **Error Budget**: 달성하지 못한 신뢰도 (예: 0.1% / 30일 = 43.2분 허용 다운타임)
- **Burn Rate**: 에러 버짓 소비 속도 (예: SLO 위반이 5분 이상 지속되면 페이지 발생)

---

## 기능 분류 (Tier System)

### Tier 1 (Critical) — 사용자 직접 노출, 차단 불가능

**특징**: 인증, 데이터 조회, 실시간 상호작용 기능
- **Availability SLO**: 99.9% (월 최대 43.2분 다운타임)
- **Latency p95 SLO**: 500ms
- **Error Rate SLO**: 0.1% (1,000개 요청 중 1개 에러 허용)

**에러 버짓 계산**: 
- 목표: 99.9% 성공률
- 30일 × 86,400초 = 2,592,000초
- 허용 다운타임: 2,592,000 × 0.001 = 2,592초 = 43.2분

### Tier 2 (Standard) — 핵심 기능, 잠시 지연 가능

**특징**: 마케팅 기능, 알림, 콘텐츠 조회
- **Availability SLO**: 99.5% (월 최대 216분 다운타임)
- **Latency p95 SLO**: 2초
- **Error Rate SLO**: 0.5%

### Tier 3 (Async/Best-effort) — 비동기 작업, 재시도 가능

**특징**: 모델컷 생성, 배경 제거, 피드 생성 등 장시간 작업
- **Job Success Rate SLO**: 95% (완료된 작업 기준)
- **Job Duration p95 SLO**: 30초 (가정: 대부분 <10초, 일부 5~15초)
- **Retry Policy**: 최대 3회 자동 재시도, 24시간 이내 수동 재시도

### Tier 4 (Internal/Admin) — 어드민 기능

**특징**: 관리자 대시보드, 기능 상태 관리, 사용자 관리
- **Availability SLO**: 99% (월 최대 432분 다운타임)
- **Latency p95 SLO**: 1초 (낮은 트래픽이라 여유)
- **Error Rate SLO**: 1%

---

## 기능별 SLI/SLO 매트릭스

| 기능 | Tier | Availability SLO | Latency p95 SLO | Error Rate SLO | 측정 방식 |
|------|------|-----------------|----------------|---------------|---------|
| **auth** | 1 | 99.9% | 500ms | 0.1% | `rate(makit_feature_invocation_total{feature="auth",status="success"}[5m]) / rate(makit_feature_invocation_total{feature="auth"}[5m])` |
| **dashboard** | 1 | 99.9% | 500ms | 0.1% | `rate(makit_feature_invocation_total{feature="dashboard"}[5m])` |
| **marketing-hub** | 1 | 99.9% | 500ms | 0.1% | HTTP request metric (GET /api/marketing/hub) |
| **nlp-analyze** | 2 | 99.5% | 2s | 0.5% | `sum(rate(makit_feature_invocation_total{feature="nlp-analyze",status="success"}[5m])) by (feature)` |
| **youtube-comments** | 2 | 99.5% | 2s | 0.5% | YouTube API + backend timeout (Tier 2 due to external API) |
| **youtube-influence** | 2 | 99.5% | 2s | 0.5% | YouTube API + backend timeout |
| **youtube-keyword-search** | 2 | 99.5% | 2s | 0.5% | YouTube API + backend timeout |
| **url-analyze** | 2 | 99.5% | 2s | 0.5% | URL crawl timeout (external network) |
| **chatbot** | 2 | 99.5% | 2s | 0.5% | Bedrock Claude API + streaming success count |
| **notifications** | 2 | 99.5% | 2s | 0.5% | WebSocket STOMP delivery count |
| **feed-generate** | 3 | 95% | 30s | 5% | Job completion rate `completed_jobs / total_jobs` |
| **remove-bg** | 3 | 95% | 30s | 5% | Job completion rate (remove.bg API) |
| **modelshot** | 3 | 95% | 30s | 5% | Job completion rate (Stable Diffusion API) |
| **review-analysis** | 2 | 99.5% | 2s | 0.5% | Bedrock batch analysis success |
| **push-notifications** | 2 | 99.5% | 2s | 0.5% | VAPID delivery count / subscription count |
| **admin-dashboard** | 4 | 99% | 1s | 1% | `rate(makit_feature_invocation_total{feature="admin-dashboard"}[5m])` |
| **i18n** | 1 | 99.9% | 500ms | 0.1% | Frontend-only (no backend SLO, but HTML integrity) |
| **pwa** | 1 | 99.9% | 500ms | 0.1% | Service Worker cache hit rate + manifest availability |

---

## PromQL 쿼리 (SLI 측정)

### Availability (정상 응답률)

```promql
# Tier 1, 2: Success rate 계산
sum(rate(makit_feature_invocation_total{feature="auth",status="success"}[5m]))
/ sum(rate(makit_feature_invocation_total{feature="auth"}[5m]))
```

**해석**: `auth` 기능의 지난 5분 성공한 요청 비율
- 1.0 = 100% (SLO 달성)
- 0.999 = 99.9% (Tier 1 경계)
- 0.995 = 99.5% (Tier 2 경계)

### Latency (응답 지연)

```promql
# p95 latency 측정
histogram_quantile(0.95, sum(rate(makit_feature_duration_seconds_bucket{feature="auth"}[5m])) by (le))
```

**해석**: 상위 5% 느린 요청의 최대 지연 시간
- Tier 1: < 500ms (SLO)
- Tier 2: < 2s (SLO)
- Tier 4: < 1s (SLO)

### Error Rate (에러 비율)

```promql
# Error rate as percentage
sum(rate(makit_feature_invocation_total{feature="nlp-analyze",status="error"}[5m]))
/ sum(rate(makit_feature_invocation_total{feature="nlp-analyze"}[5m]))
* 100
```

**해석**: 에러 비율 (%)
- 0.1% = Tier 1 경계
- 0.5% = Tier 2 경계
- 5% = Tier 3 경계

### Job Success Rate (Tier 3)

```promql
# Job success rate (모델컷, 배경 제거 등)
sum(rate(jobs_total{status="completed"}[5m]))
/ sum(rate(jobs_total[5m]))
```

**해석**: 완료된 작업 / 전체 작업
- 95% = Tier 3 SLO

---

## 에러 버짓 추적 (Error Budget)

### 월간 에러 버짓 소비율

```promql
# 지난 30일 실제 다운타임 / 허용 다운타임
# Tier 1 예시: SLO 99.9%
(1 - avg_over_time(
  (sum(rate(makit_feature_invocation_total{feature="auth",status="success"}[5m])) 
   / sum(rate(makit_feature_invocation_total{feature="auth"}[5m])))[30d:]
))
/ 0.001  # 0.1% 에러 버짓
* 100
```

**해석**: 에러 버짓 소비율
- 0% = 버짓 미사용 (SLO 초과달성)
- 50% = 버짓 반 사용 (경고 신호)
- 100% = 버짓 전소 (SLO 위반)

### 현재 Burn Rate (5분 단위)

```promql
# 현재 속도로 버짓 소진하면 몇 일 남을까?
1 - (sum(rate(makit_feature_invocation_total{feature="auth",status="success"}[5m])) 
     / sum(rate(makit_feature_invocation_total{feature="auth"}[5m])))
/ 0.001 # Tier 1 에러 버짓
```

**해석**: burn rate 값
- 1 = 정상 (SLO 달성률 100%)
- 10 = 위험 (10배 빠르게 버짓 소진, 3시간 내 전소)
- 100 = 긴급 (100배 빠르게 버짓 소진, 18분 내 전소)

---

## 알림 정책 (Alert Rules)

### P1 (Critical) — 즉시 페이지

**SLO 위반 지속 5분 이상**

```yaml
- alert: Tier1SLOBreach
  expr: |
    (sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub",status="success"}[5m]))
     / sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub"}[5m])))
    < 0.999
  for: 5m
  annotations:
    severity: critical
    summary: "{{ $labels.feature }} SLO breach (availability < 99.9%)"
    runbook: "sli-slo.md#tier-1"

- alert: Tier1HighLatency
  expr: |
    histogram_quantile(0.95, sum(rate(makit_feature_duration_seconds_bucket{feature=~"auth|dashboard|marketing-hub"}[5m])) by (le))
    > 0.5
  for: 5m
  annotations:
    severity: critical
    summary: "{{ $labels.feature }} p95 latency > 500ms"

- alert: Tier1HighErrorRate
  expr: |
    (sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub",status="error"}[5m]))
     / sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub"}[5m])))
    > 0.001
  for: 5m
  annotations:
    severity: critical
    summary: "{{ $labels.feature }} error rate > 0.1%"
```

### P2 (High) — 30분 내 대응

**SLO 위반 지속 30분 또는 버짓 50% 소진**

```yaml
- alert: Tier2SLODegradation
  expr: |
    (sum(rate(makit_feature_invocation_total{feature=~"nlp-analyze|chatbot|notifications",status="success"}[5m]))
     / sum(rate(makit_feature_invocation_total{feature=~"nlp-analyze|chatbot|notifications"}[5m])))
    < 0.995
  for: 30m
  annotations:
    severity: high
    summary: "{{ $labels.feature }} degradation (Tier 2)"

- alert: ErrorBudgetBurnRate
  expr: |
    # Tier 1 burn rate > 10배 (3시간 내 전소)
    (1 - (sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub",status="success"}[5m]))
          / sum(rate(makit_feature_invocation_total{feature=~"auth|dashboard|marketing-hub"}[5m]))))
    / 0.001
    > 10
  for: 5m
  annotations:
    severity: high
    summary: "{{ $labels.feature }} error budget burn rate elevated ({{ $value }}x)"
```

### P3 (Medium) — 24시간 내 대응

**추세 분석: 5일 평균 대비 20% 악화**

```yaml
- alert: Tier3JobFailureRate
  expr: |
    (sum(rate(jobs_total{feature=~"modelshot|feed-generate|remove-bg",status!="completed"}[5m]))
     / sum(rate(jobs_total{feature=~"modelshot|feed-generate|remove-bg"}[5m])))
    > 0.05
  for: 1h
  annotations:
    severity: medium
    summary: "{{ $labels.feature }} job failure rate > 5%"

- alert: PerformanceTrend
  expr: |
    # p95 latency 5일 평균 대비 20% 증가
    histogram_quantile(0.95, sum(rate(makit_feature_duration_seconds_bucket{feature="auth"}[5m])) by (le))
    > (avg_over_time(
      histogram_quantile(0.95, sum(rate(makit_feature_duration_seconds_bucket{feature="auth"}[5m])) by (le))[5d:1h]
      ) * 1.2)
  for: 1h
  annotations:
    severity: medium
    summary: "{{ $labels.feature }} latency trend degrading"
```

---

## 관찰 및 대응 플레이북

### Tier 1 Availability 위반

**증상**: `auth`, `dashboard`, `marketing-hub` 성공률 < 99.9%

**원인 분류**:
1. **Backend 장애** (50%)
   - PromQL: `up{job="makit"}` = 0
   - 대응: backend 포드 재시작, logs 확인, database connectivity 검증
2. **Database 연결 실패** (30%)
   - PromQL: Spring Boot health check → `db` component = DOWN
   - 대응: RDS/PostgreSQL 상태 확인, connection pool 설정
3. **외부 API timeout** (20%, Tier 2 기능)
   - PromQL: `makit_feature_duration_seconds{feature="youtube-*"}` spike
   - 대응: YouTube/Bedrock API 상태 페이지 확인, timeout 값 검토

### Tier 2 Error Rate 상승

**증상**: `nlp-analyze`, `chatbot` 에러율 > 0.5%

**원인 분류**:
1. **Bedrock API quota 초과** (40%)
   - PromQL: `bedrock.invoke{status="throttled"}` 증가
   - 대응: AWS quota 확인, request batch 재조정, cooldown 추가
2. **Invalid input** (30%)
   - PromQL: `http.server.requests{status="400"}` 증가
   - 대응: input validation 강화, 사용자 가이드 검토
3. **Temporary network failure** (30%)
   - PromQL: `makit_feature_duration_seconds{feature="url-analyze"}` spike
   - 대응: retry logic 확인, circuit breaker 상태 확인

### Tier 3 Job Success Rate 감소

**증상**: `modelshot`, `feed-generate` 완료율 < 95%

**원인 분류**:
1. **Queue 과포화** (40%)
   - PromQL: `jobs_queue_depth` 증가
   - 대응: 워커 프로세스 추가, job 우선순위 재조정
2. **Job timeout** (35%)
   - PromQL: `jobs_total{status="timeout"}` 증가
   - 대응: timeout 값 상향, 용량 계획 검토
3. **External service 장애** (25%, SD API, remove.bg)
   - PromQL: provider health check
   - 대응: fallback model 활성화, SLA 검토

---

## 월간 리뷰 체크리스트

매월 1일 DevOps 팀이 다음을 검토:

- [ ] 모든 Tier 1 기능이 99.9% 이상 달성했는가?
- [ ] 에러 버짓이 50% 이상 남았는가? (경고 임계값)
- [ ] p95 latency 트렌드가 SLO 이내인가?
- [ ] 장애 대응 시간(MTTR)은 목표치 이내인가?
  - Tier 1: 15분 이내
  - Tier 2: 1시간 이내
  - Tier 3: 4시간 이내
- [ ] 새로운 기능(R20+)이 SLO 할당받았는가?
- [ ] 사용 패턴 변화(트래픽 증가)가 확인되었는가?

**산출물**: `docs/rounds/monthly-review-YYYY-MM.md`

---

## 참고

- **[Observability Runbook](./observability.md)** — Prometheus/Grafana 설정
- **[SLO Error Budget](https://sre.google/workbook/error-budgets/)** — Google SRE 가이드
- **[Prometheus HistogramQuantile](https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile)** — p95 계산
- **[MaKIT Feature Catalog](../features/INDEX.md)** — 17개 기능 명세

---

**Last Updated**: 2026-04-26  
**Maintained By**: DevOps Team  
**Status**: Production Ready
