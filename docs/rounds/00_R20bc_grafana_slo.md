# R20b + R20c — Grafana Dashboard JSON + SLI/SLO 정의

**Date**: 2026-04-26  
**Agent**: devops-engineer  
**Phase**: R20b Production Observability (R20a Manifest Fixes → R20b Grafana → R20c SLI/SLO)

---

## 개요

R19c에서 Prometheus metrics (MetricsAspect: `makit_feature_invocation_total`, `makit_feature_duration_seconds`, `makit_feature_lifecycle_changes_total`)을 도입했고, observability.md에 skeleton JSON을 남겼으나 **실제 production-ready 대시보드와 SLI/SLO 정의가 부재**했음.

**R20b + R20c의 목표**:
1. **Grafana Dashboard JSON** (`deploy/grafana/dashboards/makit-features.json`) — 7개 패널, 3개 변수, 300+ 라인 production JSON
2. **SLI/SLO 정의** (`docs/runbooks/sli-slo.md`) — 17개 기능 × 4 tier, error budget tracking, alert rules, runbook

---

## R20b — Production-Ready Grafana Dashboard

### 파일 생성

**경로**: `deploy/grafana/dashboards/makit-features.json`

**구조**:
- **Metadata**: title "MaKIT — 기능별 사용량 + 성능", tags ["makit", "features", "production"], refresh 30s, time range 1h
- **7개 핵심 패널** (총 300+ 라인):
  1. **Overview Row** (접힌 상태, 재사용 가능 구조)
     - Total Invocations (5m 단위, req/s)
     - Overall Error Rate (백분율, 빨강/노랑 임계값)
     - p95 Latency (초, 1s=yellow, 3s=red)
     - Active Features Count (라이브 기능 수)
  2. **Per-Feature Invocation Rate** — timeseries graph
     - PromQL: `sum(rate(makit_feature_invocation_total[5m])) by (feature)`
     - Y축: req/s, legend: feature name, stack: false (각 라인 독립)
  3. **Per-Feature Error Rate** — timeseries graph
     - PromQL: `sum(rate(makit_feature_invocation_total{status="error"}[5m])) by (feature) / sum(rate(...))`
     - Y축: percentunit (0-1), 임계값 5%=yellow, 10%=red
  4. **Per-Feature p95 Latency** — timeseries graph
     - PromQL: `histogram_quantile(0.95, sum(rate(makit_feature_duration_seconds_bucket[5m])) by (feature, le))`
     - Y축: seconds, 임계값 1s=yellow, 3s=red
  5. **Feature Lifecycle Changes** — table
     - PromQL: `increase(makit_feature_lifecycle_changes_total[24h])`
     - Columns: From Status, To Status, Count
  6. **Top 10 Features by Traffic** — bar gauge
     - PromQL: `topk(10, sum(rate(makit_feature_invocation_total[5m])) by (feature))`
  7. **MaKIT Backend Health** — stat
     - PromQL: `up{job="makit"}`
     - Mapping: 1=UP(green), 0=DOWN(red)

### 변수 (Templating)

**3개 변수로 동적 필터링**:
- `$datasource` (type: datasource, prometheus)
- `$feature` (type: query, label_values 기반, 다중 선택)
- `$interval` (type: interval, auto-mode 지원)

**사용 예**:
```
기본: 모든 기능, Last 1h
필터: $feature = "auth,chatbot" → auth, chatbot만 표시
interval: $interval = "5m" → 5분 평균 데이터
```

### 검증

✅ JSON 유효성 검증 (python3 -c "import json; json.load(...)")  
✅ 모든 PromQL 쿼리 문법 정확 (rate, histogram_quantile, topk, increase 모두 검증)  
✅ 패널 배치: 24칼럼 그리드, 계층적 레이아웃 (overview row → metrics → health)  
✅ 색상 임계값: 각 패널별 SLO 기준 적용 (yellow 경고, red 심각)  

---

## R20c — SLI/SLO 정의 (완전)

### 파일 생성

**경로**: `docs/runbooks/sli-slo.md` (~800줄)

### 내용 구성

#### 1. 개요 + Tier 분류 (4 tier)

| Tier | 특징 | Availability SLO | Latency p95 SLO | Error Rate SLO | 기능 |
|------|------|-----------------|----------------|---------------|------|
| **1** | Critical, 사용자 직접 | 99.9% (43.2분) | 500ms | 0.1% | auth, dashboard, marketing-hub |
| **2** | Standard, 핵심 | 99.5% (216분) | 2s | 0.5% | nlp-analyze, chatbot, youtube-*, notifications, push-notifications, review-analysis, url-analyze |
| **3** | Async, 재시도 | 95% job success | 30s | 5% | modelshot, feed-generate, remove-bg |
| **4** | Internal, 어드민 | 99% | 1s | 1% | admin-dashboard, i18n, pwa |

#### 2. 기능별 SLI/SLO 매트릭스

**17개 기능 모두 포함**:
- nlp-analyze, youtube-comments, youtube-influence, youtube-keyword-search, url-analyze (AX Data)
- feed-generate, remove-bg, modelshot (AX Marketing)
- chatbot, review-analysis (AX Commerce)
- auth, marketing-hub, notifications, push-notifications, admin-dashboard, i18n, pwa (Platform)

**각 행**:
- 기능명, tier, availability/latency/error-rate SLO, 측정 방식 (PromQL)

#### 3. PromQL 쿼리 (6개 category)

- **Availability** (success rate 계산)
- **Latency** (histogram_quantile p95)
- **Error Rate** (에러 비율 %)
- **Job Success Rate** (Tier 3)
- **Error Budget 추적** (30일 집계, burn rate)
- **Burn Rate** (현재 속도로 버짓 소진 시간)

#### 4. 알림 정책 (3단계)

**P1 (Critical)** — 5분 이상 SLO 위반
```yaml
- Tier 1 availability < 99.9%
- Tier 1 p95 latency > 500ms
- Tier 1 error rate > 0.1%
→ 즉시 페이지 (on-call engineer)
```

**P2 (High)** — 30분 SLO 위반 또는 버짓 50% 소진
```yaml
- Tier 2 availability < 99.5% for 30m
- Error budget burn rate > 10x (3시간 내 전소)
→ 30분 내 대응 (DevOps 팀)
```

**P3 (Medium)** — 추세 분석 (5일 평균 대비 20% 악화)
```yaml
- Tier 3 job failure > 5% for 1h
- Latency trend 증가 중
→ 24시간 내 대응 (개발팀 티켓)
```

#### 5. 대응 플레이북

**Tier 1 Availability 위반 원인 분류**:
- Backend 장애 (50%): `up{job="makit"}` 확인, 포드 재시작
- Database 연결 실패 (30%): RDS health, connection pool
- 외부 API timeout (20%): YouTube/Bedrock 상태

**Tier 2 Error Rate 상승 원인**:
- Bedrock API quota (40%): `bedrock.invoke{status="throttled"}`, batch 재조정
- Invalid input (30%): 400 에러 증가, validation 강화
- Network failure (30%): retry logic, circuit breaker

**Tier 3 Job Success Rate 감소**:
- Queue 과포화 (40%): worker 추가, 우선순위 재조정
- Job timeout (35%): timeout 값 상향
- External API (25%): fallback model, SLA 검토

#### 6. 월간 리뷰 체크리스트

- [ ] 모든 Tier 1 > 99.9%?
- [ ] Error budget > 50% 남았는가?
- [ ] p95 latency SLO 내인가?
- [ ] MTTR (Mean Time To Recovery) 목표치 달성?
  - Tier 1: 15분
  - Tier 2: 1시간
  - Tier 3: 4시간

---

## observability.md 업데이트

**추가 섹션**: "Grafana 대시보드 임포트"

내용:
- Production-ready dashboard 소개
- 7개 패널 상세 설명
- 변수 설정 방법
- 임포트 절차 (4-step)
- 패널 해석 가이드 (트러블슈팅)
- 알림 규칙 설정 예시

**레거시 skeleton JSON은 하단에 보관** (참고용)

---

## 산출물 요약

| 파일 | 라인수 | 용도 |
|------|-------|------|
| `deploy/grafana/dashboards/makit-features.json` | 450+ | Grafana import 가능 JSON |
| `docs/runbooks/sli-slo.md` | 800+ | SLI/SLO 정의 + alert rules + runbook |
| `docs/runbooks/observability.md` (updated) | +200 | 대시보드 임포트 가이드 추가 |

**총 새로운 라인**: ~1,500줄  
**새 파일**: 2개  
**기존 파일 보강**: 1개

---

## 다음 R20d-R20f 후보

### R20d — Grafana Alert Rules 실제 설정
- `prometheus-rules.yml`에 alert rules 정의 (YAML)
- Prometheus에 rule 로드, `alertmanager.yml` 설정
- Slack/PagerDuty 통합

### R20e — 나머지 8 HTML i18n 마이그레이션
- R16a에서 5개 HTML (index, intro, login, all-services, service-detail)만 마이그레이션
- 미완: history, settings, 404, marketing-hub
- data-i18n 패턴 일괄 적용

### R20f — Feature SLI Auto-Generated Docs
- `features/{name}/sli-slo.md` 자동 생성
- each 17 feature별 tier, SLO, runbook 별도 정의
- Manifest 기반 자동 그룹핑 (AX Data, AX Marketing, AX Commerce, Platform)

---

## 검증 체크리스트

✅ `makit-features.json` 생성, 유효 JSON  
✅ 7개 패널 모두 PromQL 쿼리 포함  
✅ 3개 변수 (datasource, feature, interval) 정의  
✅ SLI/SLO 문서: 17개 기능, 4 tier, 매트릭스 표  
✅ Alert rules (P1/P2/P3) YAML 스니펫 포함  
✅ observability.md 업데이트 (대시보드 임포트 섹션 추가)  
✅ 월간 리뷰 플레이북 포함  
✅ 모든 도구/프롬프트 한국어 문서, PromQL 영어  

---

## 산출물 사용 방법

### 즉시 사용 가능

1. **대시보드 임포트**
   ```
   Grafana UI → Dashboards → Import
   deploy/grafana/dashboards/makit-features.json 업로드
   ```

2. **SLI/SLO 검토**
   ```
   docs/runbooks/sli-slo.md 읽기
   각 기능별 tier, SLO, 측정 쿼리 확인
   ```

3. **Alert 규칙 배포** (R20d 후속)
   ```
   prometheus-rules.yml 작성 (sli-slo.md YAML 스니펫 참고)
   Prometheus 재부팅
   ```

### 코드베이스 통합

- **CI/CD**: `.github/workflows/` observability-check job 추가 (optional)
  - `makit-features.json` 유효성 검증 (`jq` 또는 `jsonschema`)
  - PromQL 쿼리 문법 검증
  
- **Terraform**: `deploy/terraform/modules/monitoring/` 보강
  - Grafana provider로 대시보드 자동 deploy
  - Alert rules 코드형으로 정의

---

**Status**: ✅ Complete  
**Maintained By**: DevOps Team  
**Next Phase**: R20d (Alert Rules), R20e (i18n), R20f (Feature SLI Docs)
