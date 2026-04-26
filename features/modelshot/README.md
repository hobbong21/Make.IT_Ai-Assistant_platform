# 모델컷 생성

> **상태**: stable | **카테고리**: ax-marketing | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 모델컷 생성

> 상품 설명으로 AI 생성 모델 이미지 및 배치 생성

## 목적

AI 이미지 생성으로 모델 촬영 비용 절감

## 사용자 시나리오

1. 의류 브랜드가 '프리미엄 여름 셔츠, 검은색, 일반체형' 설명 입력
2. 시스템이 Bedrock Claude로 이미지 생성 프롬프트 생성
3. AI 이미지 생성 모델 (Stable Diffusion)로 모델 이미지 5장 생성
4. 생성된 이미지를 상품 페이지에 배치

## 기술 스택

### 백엔드
- **서비스**: ModelshotService
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/commerce/modelshot | Required (JWT) |

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
| R1 | 2026-04-(초기) |  |
| R7 | 2026-04-(service-detail | 통합) |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
