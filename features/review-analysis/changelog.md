# 변경 이력

## R17 (2026-04-26) — 기능 카탈로그 도입

기능별 모듈화 및 문서화 시작. manifest.json, api.md, changelog.md 신설.

| 날짜 | 라운드 | 변경 내용 | 파일 | 상태 |
|------|--------|---------|------|------|
| 2026-04-26 | R17 | features/ 카탈로그 도입 | README.md, manifest.json, api.md, changelog.md | 신설 |

---

## 이전 라운드 (역순)

### 개요

이 기능은 다음 라운드들에서 개발/보강되었습니다:

| 라운드 | 날짜 | 주요 변경 | 기여자 |
|--------|------|---------|-------|
| R{N} | 2026-04-{DD} | {변경 요약} | {architect/backend-engineer/ai-engineer/frontend-engineer/devops-engineer/qa-engineer} |

---

## 개발 일정

- [ ] **Backlog** — 설계 및 계획
- [x] **초기화** — v1 아키텍처 설립
- [x] **구현** — 백엔드/프론트엔드 완성
- [x] **통합** — 엔드-투-엔드 테스트
- [x] **최적화** — 성능 및 보안 강화
- [ ] **운영** — 프로덕션 배포 후 모니터링

---

## 알려진 문제

| 이슈 | 심각도 | 상태 | 예상 해결 |
|------|--------|------|---------|
| {설명} | 🔴 Critical / 🟠 Major / 🟡 Minor | Open/In Progress/Resolved | R{N} |

---

## 마이그레이션 가이드

### v{N} → v{N+1}

{이전 버전에서 마이그레이션이 필요한 경우 작성}

```bash
# 데이터베이스
flyway migrate

# 프론트엔드 캐시 초기화
rm -rf frontend/dist
npm run build
```

---

## 성능 개선

| 메트릭 | 이전 | 개선 후 | 변경율 |
|--------|------|--------|-------|
| {메트릭명} | 100ms | 50ms | -50% |

---

## 보안 업데이트

- {보안 취약점 수정 이력}
- {인증/권한 강화}
- {입력 검증 개선}

---

## 참고 문서

- [README.md](./README.md) — 기능 설명
- [manifest.json](./manifest.json) — 파일 매핑
- [api.md](./api.md) — API 명세
