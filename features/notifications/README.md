# 알림 시스템

> **상태**: stable | **카테고리**: platform | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 0 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 알림 시스템

> 실시간 사용자 알림 (WebSocket + 데이터베이스)

## 목적

사용자 행동 추적 및 실시간 알림

## 사용자 시나리오

1. 사용자가 캠페인을 생성하거나 작업 완료 이벤트 발생
2. NotificationService가 메시지 저장 + WebSocket 동시 발송
3. 브라우저가 실시간으로 알림 종 배지 갱신 + toast 표시
4. 알림을 클릭하면 관련 페이지로 이동

## 기술 스택

### 백엔드
- **서비스**: NotificationService, NotificationController
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/notifications/create | Required (JWT) |

상세한 내용은 [api.md](./api.md) 참고.

## 의존성

### 내부
- `auth` — JWT 인증
- `audit` — @Auditable 감시

### 외부
- AWS Bedrock (일부 기능)
- PostgreSQL

## 변경 이력

최신 라운드별 이력은 [changelog.md](./changelog.md) 참고.

| 라운드 | 날짜 | 변경 |
|--------|------|------|
| R5 | 2026-04-(기본 | 알림 센터) |
| R8 | 2026-04-(실시간 | WebSocket) |
| R13 | 2026-04-(실 | 트리거 통합) |
| R15 | 2026-04-(analytics) |  |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
