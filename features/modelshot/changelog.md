# modelshot — 변경 이력

| 날짜 | 라운드 | 변경 내용 | 파일 |
| 2026-04-26 | R20a | manifest 파일경로 정정 | manifest.json |
|------|--------|---------|------|
| 2026-04-20 | R1 | 초기 구현 — 모델컷 생성 API 정의 | ModelshotService |
| 2026-04-24 | R7 | service-detail 페이지 통합 — 자연어 설명 입력 + 비동기 작업 폴링 | service-detail.html, service-detail.js |
| 2026-04-26 | R18a | features/ 카탈로그 데이터 보강 | features/modelshot/ |

## 상태

- **v1.0.0** — Stable (2026-04-26 기준)
- 백엔드: 실제 데이터 수집 대기 (대부분 stub)
- 프론트엔드: service-detail 통합 완료
- 테스트: E2E 스펙 작성 완료

## 마일스톤

| 항목 | 상태 | 예상 시기 |
|------|------|---------|
| API 인터페이스 정의 | ✅ | R1 |
| 프론트엔드 UI 통합 | ✅ | R7 |
| API 명세 작성 | ✅ | R18a |
| 실제 AI/API 통합 | ⏳ | R{TBD} |
| 프로덕션 배포 | ⏳ | R{TBD} |

## 참고 문서

- [README.md](./README.md) — 기능 설명
- [manifest.json](./manifest.json) — 파일 매핑
- [api.md](./api.md) — API 명세
