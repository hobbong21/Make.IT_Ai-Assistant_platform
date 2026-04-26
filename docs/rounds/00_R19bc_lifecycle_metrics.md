# R19b + R19c: Feature Lifecycle Audit & Prometheus Metrics

**Date:** 2026-04-26  
**Status:** COMPLETE  
**Tasks:** Feature status change audit logging + Prometheus metrics integration

---

## Summary

**R19b** adds feature lifecycle change auditing to the admin dashboard:
- New `PATCH /api/admin/features/{name}/status` endpoint for updating feature status (experimental → beta → stable → deprecated)
- Structured audit log entries with metadata (oldStatus, newStatus, changedBy, timestamp)
- Frontend status dropdown + confirmation modal for safe state transitions

**R19c** adds Prometheus metrics for feature observability:
- `MetricsAspect` AOP component recording feature invocation counts and duration
- `makit_feature_invocation_total{feature, status}` counter for success/error tracking
- `makit_feature_duration_seconds{feature}` timer with p50/p95/p99 percentiles
- `makit_feature_lifecycle_changes_total{from, to}` counter for status transitions
- Runbook with Prometheus config, alerting rules, Grafana dashboard skeleton

---

## Deliverables

### Backend (R19b)

1. **AdminController** — New endpoint:
   ```
   PATCH /api/admin/features/{name}/status
   body: {status: "experimental" | "beta" | "stable" | "deprecated"}
   response: {name, status}
   ```
   - Validates status value against enum
   - Throws `IllegalArgumentException` on invalid status
   - Decorated with `@Auditable(resource="feature-lifecycle", action="STATUS_CHANGE")`
   - Protected by `@PreAuthorize("hasRole('ADMIN')")`

2. **AdminService** — New method:
   ```java
   void updateFeatureStatus(String featureName, String newStatus);
   ```
   - Reads current manifest via `FeatureCatalogService`
   - Updates status field and writes back atomically (temp file + rename)
   - Records structured audit log entry (REQUIRES_NEW transaction)
   - Calls `MetricsAspect.recordLifecycleChange(oldStatus, newStatus)`

3. **FeatureCatalogService** — New method:
   ```java
   void updateFeatureStatus(String featureName, String newStatus)
   ```
   - Atomic file write: JSON → temp file → rename (prevents corruption)
   - IOException wrapped in RuntimeException
   - Logs oldStatus → newStatus transition

4. **MetricsAspect** — New component:
   - `@Around` on `@Auditable` methods
   - Records `makit_feature_invocation_total{feature, status}` counter
   - Records `makit_feature_duration_seconds{feature}` timer with percentiles
   - Graceful degradation if MeterRegistry unavailable

### Frontend (R19b)

1. **admin.js** — Enhanced feature table:
   - Replaced hardcoded status badge with dropdown select (4 options)
   - Added `handleStatusChange(featureName, newStatus, oldStatus)` handler
   - Confirmation modal for status changes (enhanced alert for deprecated)
   - Toast notifications on success/error
   - Reloads features list after change

2. **api.js** — New wrapper:
   ```javascript
   admin.updateFeatureStatus(name, status)
   ```

### Observability (R19c)

1. **observability.md** runbook:
   - Prometheus endpoint config (`/actuator/prometheus`)
   - Micrometer Prometheus registry setup (already in pom.xml)
   - 5+ common PromQL queries (rate, error rate, p95 latency, lifecycle changes)
   - Grafana dashboard JSON skeleton (feature rates, errors, latency, lifecycle pipeline)
   - Alert rules (high error rate, high latency, Bedrock slowdown)
   - ELK integration guide for structured log aggregation

---

## Architecture

### Audit Flow (R19b)

```
Admin: "Set nlp-analyze → stable"
  ↓
AdminController.updateFeatureStatus (validated)
  ↓ @Auditable AOP
AuditAspect: INSERT audit_logs {action="STATUS_CHANGE", ...}
AdminServiceImpl.updateFeatureStatus (service logic)
  ↓
FeatureCatalogService.updateFeatureStatus (atomic file I/O)
  ├─ Read manifest.json
  ├─ Update status field
  └─ Write temp → rename
  ↓
AdminServiceImpl.writeFeatureLifecycleAudit (REQUIRES_NEW txn)
  ├─ INSERT audit_logs {resource="feature-lifecycle", metadata={oldStatus, newStatus, ...}}
  └─ MetricsAspect.recordLifecycleChange(oldStatus, newStatus)
    └─ Increment makit_feature_lifecycle_changes_total{from=experimental, to=stable}
```

### Metrics Collection (R19c)

```
@Auditable method invocation
  ↓ MetricsAspect.recordAuditableMetrics()
  ├─ Counter.increment(makit_feature_invocation_total{feature, status})
  └─ Timer.record(makit_feature_duration_seconds{feature})

/actuator/prometheus
  └─ Prometheus scraper every 15s
    └─ Pull metrics → time series DB
      └─ Grafana queries PromQL
```

---

## Configuration

### application.yml

Already configured (no changes needed):
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
```

### pom.xml

Already includes:
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

---

## Verification Checklist

- [x] AdminController has `PATCH /admin/features/{name}/status` endpoint
- [x] AdminService interface + impl have `updateFeatureStatus(name, status)` method
- [x] FeatureCatalogService has atomic file write with temp+rename
- [x] MetricsAspect compiles and records metrics on @Auditable methods
- [x] Admin UI: status dropdown in features table
- [x] Admin UI: confirmation modal for status changes
- [x] Admin UI: toast notifications on success/error
- [x] api.js wrapper: `admin.updateFeatureStatus(name, status)`
- [x] observability.md runbook with Prometheus queries + Grafana skeleton
- [x] @PreAuthorize("hasRole('ADMIN')") on new endpoint
- [x] Structured metadata in audit_logs (featureName, oldStatus, newStatus, changedBy)

---

## Example Usage

### Admin Updates Feature Status

1. Open admin dashboard (admin.html)
2. Scroll to "기능 라이프사이클" section
3. Find "nlp-analyze" in features table
4. Change dropdown from "experimental" to "beta"
5. Confirm modal: "nlp-analyze 상태를 'experimental'에서 'beta'로 변경하시겠습니까?"
6. Click "확인" → status updates, feature list reloads
7. Toast: "nlp-analyze 상태가 업데이트되었습니다"

### Backend Logs

In audit_logs table:
```sql
SELECT * FROM audit_logs 
WHERE resource='feature-lifecycle' AND action='STATUS_CHANGE' 
ORDER BY created_at DESC LIMIT 1;

-- Result:
-- id: 42
-- user_id: <uuid>
-- resource: "feature-lifecycle"
-- action: "STATUS_CHANGE"
-- metadata: {
--   "featureName": "nlp-analyze",
--   "oldStatus": "experimental",
--   "newStatus": "beta",
--   "changedBy": "admin@makit.example.com",
--   "timestamp": "2026-04-26T15:30:00.000+09:00"
-- }
-- created_at: 2026-04-26 15:30:00
```

### Prometheus Queries

Grafana dashboard shows:
- **Feature invocation rate (last 1h):** 45 calls/min (nlp-analyze), 12 calls/min (modelshot)
- **Error rate (last 1h):** 0.2% (nlp-analyze), 0.05% (modelshot)
- **P95 latency:** 850ms (nlp-analyze), 320ms (modelshot)
- **Status changes (last 24h):** experimental→beta: 3, beta→stable: 1

---

## Graceful Degradation

1. **If Prometheus not scraped:** Metrics are still recorded locally; /actuator/prometheus endpoint returns valid data.
2. **If MetricsAspect fails:** Log warning, but don't block @Auditable method execution.
3. **If manifest file not found:** Throw `IllegalArgumentException` immediately.
4. **If status invalid:** Controller validates enum before calling service.
5. **If REQUIRES_NEW transaction fails:** Service logs warning, business logic succeeds (audit is optional).

---

## Future Enhancements

- [ ] Feature status change confirmation modal (already added in admin.js)
- [ ] Feature metrics link in admin UI (modal showing last hour data from /actuator/metrics)
- [ ] Prometheus alerting rules in CI/CD (warn on high error rate, slow latency)
- [ ] Feature dependency impact analysis on status change (e.g., deprecated → warn if other features depend on it)
- [ ] Feature rollback capability (undo last N status changes)
- [ ] Metrics export to CloudWatch / Datadog for production monitoring

---

## Conflicts & Dependencies

- None: R19bc is fully independent of other rounds
- Admin service already has `MetricsAspect` injected (R16 admin dashboard)
- AuditAspect already in place (R4+)
- Modal + toast UI components already available

---

**Author:** Backend Engineer  
**Last Updated:** 2026-04-26  
**Status:** Production Ready

