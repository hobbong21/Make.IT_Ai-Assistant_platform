# MaKIT Observability Runbook

## Overview

MaKIT backend exposes Prometheus metrics and audit logs for observability. This runbook covers enabling Prometheus scraping, querying metrics, and setting up Grafana dashboards.

## Prometheus Endpoint

**URL:** `http://localhost:8083/actuator/prometheus`

**Exposed metrics:**
- `makit_feature_invocation_total{feature, status}` — Feature method invocations (success/error)
- `makit_feature_duration_seconds{feature}` — Feature method execution time (p50, p95, p99 percentiles)
- `makit_feature_lifecycle_changes_total{from, to}` — Feature status transitions
- `http.server.requests{method, uri, status}` — HTTP request metrics
- `bedrock.invoke{model}` — Bedrock API call metrics (latency, count)
- Standard JVM metrics: `jvm.memory.used`, `jvm.threads.live`, `process.cpu.usage`, etc.

## Configuration

### Enable Prometheus in application.yml

The backend already exposes `/actuator/prometheus` by default. Verify in `backend/src/main/resources/application.yml`:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus  # prometheus must be in list
  endpoint:
    health:
      show-details: when_authorized
  metrics:
    tags:
      application: makit-backend
    distribution:
      percentiles-histogram:
        bedrock.invoke: true
        http.server.requests: true
```

### Prometheus Server Config

Add MaKIT backend to your Prometheus `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'makit'
    static_configs:
      - targets: ['localhost:8083']
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
    scrape_timeout: 5s
```

### Deploy with Docker Compose

If using `docker-compose.yml`, add Prometheus service:

```yaml
prometheus:
  image: prom/prometheus:v2.47.0
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
  networks:
    - makit-network

volumes:
  prometheus-data:

networks:
  makit-network:
    driver: bridge
```

## Common Prometheus Queries

### Feature Invocation Rate (last 5 min)

```promql
rate(makit_feature_invocation_total[5m])
```

### Feature Error Rate

```promql
rate(makit_feature_invocation_total{status="error"}[5m])
/ rate(makit_feature_invocation_total[5m])
```

### Feature P95 Latency

```promql
histogram_quantile(0.95, makit_feature_duration_seconds)
```

### Bedrock API Latency (P99)

```promql
histogram_quantile(0.99, rate(bedrock.invoke_seconds_bucket[5m]))
```

### Feature Status Change History

```promql
rate(makit_feature_lifecycle_changes_total[1h])
```

### Active HTTP Requests

```promql
sum(increase(http.server.requests_total[1m])) by (uri, status)
```

## Feature Lifecycle Audit

When an admin updates a feature status (experimental → beta → stable → deprecated), the system records:

1. **Audit Log Entry** in `audit_logs` table:
   - `resource`: `feature-lifecycle`
   - `action`: `STATUS_CHANGE`
   - `metadata`: `{featureName, oldStatus, newStatus, changedBy, timestamp}`

2. **Prometheus Counter** `makit_feature_lifecycle_changes_total{from, to}`:
   - Tracks all status transitions
   - Use for dashboards: "Feature Stability Pipeline"

### Query: Feature Status Change Timeline

```sql
SELECT 
  feature_name,
  old_status,
  new_status,
  changed_by,
  created_at
FROM audit_logs
WHERE resource = 'feature-lifecycle'
  AND action = 'STATUS_CHANGE'
ORDER BY created_at DESC
LIMIT 50;
```

## Grafana 대시보드 임포트 (Production-Ready)

### MaKIT Features Dashboard

**파일**: `deploy/grafana/dashboards/makit-features.json`

MaKIT production 대시보드는 다음을 포함합니다:

#### 패널 구성

1. **Overview Row (접힌 상태)** — 4개 stat 패널
   - Total Invocations (지난 5분)
   - Overall Error Rate (전체 기능 평균)
   - p95 Latency (모든 기능 병합)
   - Active Features Count (라이브 기능 수)

2. **Per-Feature Invocation Rate** — 라인 차트
   - 각 기능별 초당 요청 수 (`req/s`)
   - 5분 평균, 스택 미적용 (독립 라인)

3. **Per-Feature Error Rate** — 라인 차트
   - 각 기능별 에러 비율 (%)
   - 임계값: 5% = yellow, 10% = red

4. **Per-Feature p95 Latency** — 라인 차트
   - 각 기능별 95 percentile 지연 시간 (초)
   - 임계값: 1s = yellow, 3s = red

5. **Feature Lifecycle Changes** — 테이블
   - 지난 24시간 상태 변화 (experimental→beta→stable 등)
   - From, To, Count 컬럼

6. **Top 10 Features by Traffic** — Bar Gauge
   - 트래픽 기준 상위 10개 기능
   - 색상 그라디언트 (높을수록 진함)

7. **MaKIT Backend Health** — Single Stat
   - `up{job="makit"}` = 1 (green/UP) 또는 0 (red/DOWN)

#### 변수 (Templating)

- **$datasource**: Prometheus 데이터소스 선택
- **$feature**: 다중 선택 기능 필터 (전체 또는 특정 기능)
- **$interval**: 시간 해상도 (1m, 5m, 10m, 30m, 1h, 6h, 8h, 16h, 1d)

#### 임포트 절차

**Step 1: Grafana 접속**
```
http://localhost:3000
ID: admin
PW: admin (기본값, 본인 비밀번호로 변경)
```

**Step 2: Import 메뉴**
- 좌측 메뉴 → **Dashboards** → **New** → **Import**

**Step 3: JSON 로드**

*옵션 A: 파일 업로드*
```
- Browse 버튼 클릭
- deploy/grafana/dashboards/makit-features.json 선택
- Upload 클릭
```

*옵션 B: Raw JSON 붙여넣기*
```
- "Paste JSON" 텍스트 박스에 JSON 내용 붙여넣기
- Load 클릭
```

**Step 4: 설정 확인**
- Dashboard name: "MaKIT — 기능별 사용량 + 성능" (자동 채워짐)
- Prometheus data source: **prometheus** 선택
- **Import** 클릭

**Step 5: 변수 설정**

대시보드 상단의 드롭다운 변수들을 설정:
- **Datasource**: Prometheus (이미 선택됨)
- **Feature**: "All" 또는 특정 기능 다중 선택
  - 예: `auth`, `chatbot`, `nlp-analyze` 동시 모니터링
- **Interval**: `auto` (권장) 또는 고정값

#### 패널 해석 가이드

**Invocation Rate가 0에 가까움**
- 원인: 기능을 아무도 사용하지 않음 또는 시간 범위 부재
- 해결: 시간 범위를 "Last 24h"로 확대하거나, Feature 필터 "All"로 변경

**Error Rate가 5% 이상**
- 심각도: 🔴 Critical (Tier 1: SLO 위반)
- 대응: 
  1. Prometheus에서 해당 기능 로그 상세 조회
  2. Backend 서버 재시작 또는 상태 확인
  3. 외부 API (YouTube, Bedrock) 상태 페이지 확인

**p95 Latency가 3초 이상**
- 심각도: 🟡 High (Tier 2 기능), 🔴 Critical (Tier 1)
- 원인:
  - Backend 과부하 (CPU, 메모리)
  - Database 쿼리 느림
  - 네트워크 지연
- 대응: CPU/메모리 모니터링, 쿼리 최적화, 네트워크 상태 확인

**Active Features 수가 변함**
- 배포 중 일부 기능이 재시작 중임 (정상)
- 예상치 못한 기능 오프라인: 배포 오류 또는 장애

#### 시간 범위 선택 (우상단)

기본값: "Last 1h" (지난 1시간)

상황별 추천:
- **실시간 모니터링**: Last 5m, refresh 30s (기본)
- **최근 추세**: Last 24h
- **주간 분석**: Last 7d (트래픽 패턴 비교)
- **월간 리뷰**: Last 30d (SLO 달성률 검증)

#### 알림 규칙 설정

Grafana Unified Alerting을 사용하여 자동 페이지 구성:

**Step 1: Alert 규칙 생성**
- 대시보드 상단 **Alert** 버튼
- **Create alert** 클릭
- 패널 선택 (예: "Per-Feature Error Rate")

**Step 2: 조건 설정**

```
A: makit_feature_invocation_total{status="error"}
B: makit_feature_invocation_total

Condition: B / A > 0.001 (0.1% = Tier 1 SLO)
For: 5m (5분 이상 지속)
```

**Step 3: 알림 채널**
- Slack, PagerDuty, Email, Webhook 등 선택
- 메시지 템플릿:
  ```
  🚨 {{ $labels.feature }} Error Rate: {{ $value }}
  Runbook: docs/runbooks/sli-slo.md
  ```

---

## Grafana Dashboard Skeleton (Legacy)

이전 스켈레톤은 `makit-features.json`으로 대체되었습니다. 아래는 참고용 minimal 예시입니다.

```json
{
  "dashboard": {
    "title": "MaKIT Feature Observability",
    "panels": [
      {
        "title": "Feature Invocation Rate",
        "targets": [
          {
            "expr": "rate(makit_feature_invocation_total[5m])",
            "legendFormat": "{{feature}} {{status}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Feature Error Rate %",
        "targets": [
          {
            "expr": "100 * rate(makit_feature_invocation_total{status=\"error\"}[5m]) / rate(makit_feature_invocation_total[5m])",
            "legendFormat": "{{feature}}"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Feature P95 Latency (ms)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, makit_feature_duration_seconds) * 1000",
            "legendFormat": "{{feature}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Status Changes (last 24h)",
        "targets": [
          {
            "expr": "increase(makit_feature_lifecycle_changes_total[24h])",
            "legendFormat": "{{from}} → {{to}}"
          }
        ],
        "type": "table"
      },
      {
        "title": "JVM Memory Usage",
        "targets": [
          {
            "expr": "jvm.memory.used{area=\"heap\"} / jvm.memory.max{area=\"heap\"} * 100",
            "legendFormat": "Heap %"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

### Import Dashboard in Grafana

1. Log in to Grafana (default: admin/admin on port 3000)
2. **Dashboards** → **Import**
3. Paste the JSON above
4. Select Prometheus as data source
5. Click **Import**

## Alerting Rules

Create Prometheus alert rules in `prometheus-rules.yml`:

```yaml
groups:
  - name: makit_alerts
    rules:
      - alert: FeatureHighErrorRate
        expr: |
          rate(makit_feature_invocation_total{status="error"}[5m])
          / rate(makit_feature_invocation_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Feature {{ $labels.feature }} has >10% error rate"
          
      - alert: FeatureHighLatency
        expr: |
          histogram_quantile(0.95, makit_feature_duration_seconds) > 5
        for: 10m
        annotations:
          summary: "Feature {{ $labels.feature }} P95 latency > 5s"
          
      - alert: BedrockApiSlowdown
        expr: |
          rate(bedrock.invoke_seconds_sum[5m])
          / rate(bedrock.invoke_seconds_count[5m]) > 2
        for: 10m
        annotations:
          summary: "Bedrock API slow (avg > 2s)"
```

Include in Prometheus config:

```yaml
rule_files:
  - 'prometheus-rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']  # Alertmanager service
```

## Metrics Integration with AOP

The `@Auditable` annotation and `MetricsAspect` work together:

1. **Controller method** tagged with `@Auditable(resource="nlp-analyze", action="ANALYZE")`
2. **AuditAspect** intercepts → logs to `audit_logs` table
3. **MetricsAspect** intercepts (same annotation) → increments `makit_feature_invocation_total{feature="nlp-analyze"}` + records duration in `makit_feature_duration_seconds{feature="nlp-analyze"}`

Result: every service call is audited AND metricked without boilerplate.

## Health Check

Endpoint: `GET /actuator/health`

Sample response:
```json
{
  "status": "UP",
  "components": {
    "db": {"status": "UP"},
    "redis": {"status": "UP"},
    "livenessState": {"status": "UP"},
    "readinessState": {"status": "UP"}
  }
}
```

## Logs Integration

Structured logs (JSON format) can be aggregated with ELK Stack:

- `logstash` → ingest from `stdout` or log files
- `elasticsearch` → index
- `kibana` → query/visualize

Example logstash config to parse MaKIT audit logs:

```
input {
  stdin {}
}

filter {
  json { source => "message" }
  if [resource] == "feature-lifecycle" {
    mutate {
      add_field => { "[@metadata][index]" => "makit-features" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "%{[@metadata][index]}-%{+YYYY.MM.dd}"
  }
}
```

## Troubleshooting

### Prometheus Can't Scrape Backend

**Symptom:** `No Data` in Prometheus query UI

**Solution:**
1. Check backend is running: `curl http://localhost:8083/actuator/health`
2. Verify Prometheus can reach: `curl http://localhost:8083/actuator/prometheus`
3. Check Prometheus logs: `docker logs prometheus` (if containerized)
4. In Prometheus UI, go to **Status** → **Targets** → look for `makit` job

### Metrics Missing After Code Deploy

**Symptom:** New `@Auditable` method not showing counters

**Solution:**
1. Restart backend (metrics are created on first invocation)
2. Call the endpoint at least once to trigger metric creation
3. Wait 15s (default scrape interval) for Prometheus to scrape

### Grafana Dashboard Blank

**Symptom:** Dashboard loads but all panels show "No Data"

**Solution:**
1. Check Prometheus data source is healthy: **Configuration** → **Data Sources** → Test
2. Verify query syntax in panel: Edit panel → inspect query results
3. Check time range: switch to "Last 24h" in top-right
4. Ensure backend has been running long enough to accumulate data

## References

- [Spring Boot Actuator Docs](https://spring.io/guides/gs/actuator-service/)
- [Micrometer Prometheus Registry](https://micrometer.io/docs/registry/prometheus)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboarding](https://grafana.com/docs/grafana/latest/dashboards/)

---

**Last Updated:** 2026-04-26  
**Maintained By:** DevOps Team  
**Status:** Production Ready
