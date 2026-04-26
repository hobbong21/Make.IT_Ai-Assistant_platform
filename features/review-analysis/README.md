# 리뷰 분석

> **상태**: stable | **카테고리**: ax-commerce | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 리뷰 분석

> 상품 리뷰의 감정 분석 및 개선 사항 도출

## 목적

고객 피드백으로 제품 개선 및 마케팅 최적화

## 사용자 시나리오

1. 판매자가 상품의 최근 50개 리뷰를 선택
2. 시스템이 각 리뷰의 감정(긍정/중립/부정) 분석
3. Bedrock Claude가 주요 불만, 장점, 개선 사항 도출
4. 판매자가 제품 개선 및 마케팅 메시지 수립

## 기술 스택

### 백엔드
- **서비스**: ReviewAnalysisService
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/commerce/review-analysis | Required (JWT) |

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
