# 관리자 대시보드

> **상태**: stable | **카테고리**: platform | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 3 / frontend 3 / tests 0 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 관리자 대시보드

> 플랫폼 통계, 사용자 관리, 알림 분석 (ROLE_ADMIN)

## 목적

플랫폼 운영진의 전체 시스템 모니터링

## 사용자 시나리오

1. 관리자가 /admin에 접근하면 @PreAuthorize(ROLE_ADMIN) 확인
2. 대시보드에 일일 활성 사용자, 누적 요청 수, 사용량 그래프 표시
3. 사용자 테이블에서 역할 변경, 계정 정지 등 관리
4. 알림 분석 도넛 차트로 타입별 분포 확인

## 기술 스택

### 백엔드
- **서비스**: AdminController, AdminService
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| GET | /api/admin/stats/overview | Required (JWT) |

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
| R16b | 2026-04-(full-stack | 구현) |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
