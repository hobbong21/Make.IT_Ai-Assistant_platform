# 푸시 알림

> **상태**: stable | **카테고리**: platform | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 3 / frontend 3 / tests 0 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 푸시 알림

> Web Push API를 통한 OS 레벨 푸시 알림 (VAPID)

## 목적

앱 설치 없이 모바일 푸시 알림 지원

## 사용자 시나리오

1. 사용자가 Settings에서 '푸시 알림 활성화' 토글
2. 브라우저가 permission 요청, 사용자 승인
3. PushSubscriptionController가 구독 정보 저장
4. 향후 모든 notification이 자동으로 푸시 발송 (탭 열려있지 않아도)

## 기술 스택

### 백엔드
- **서비스**: PushSubscriptionController, VapidConfig
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/notifications/push/subscribe | Required (JWT) |

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
| R14c | 2026-04-(VAPID | 통합) |
| R15a | 2026-04-(analytics) |  |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
