# AI 챗봇

> **상태**: stable | **카테고리**: ax-commerce | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 3 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# AI 챗봇

> RAG 기반 고객 상담 챗봇 (실시간 스트리밍)

## 목적

24/7 자동 고객 상담으로 운영 비용 절감

## 사용자 시나리오

1. 고객이 우하단 챗봇 위젯을 클릭하여 '환불 정책' 질문
2. 시스템이 RAG로 상품 정책 문서에서 관련 정보 검색
3. Bedrock Claude가 검색된 정보를 바탕으로 친절한 답변 생성
4. 실시간 스트리밍으로 답변이 타이핑되는 것처럼 나타남

## 기술 스택

### 백엔드
- **서비스**: ChatbotService, ChatbotStreamController
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/commerce/chatbot/stream | Required (JWT) |

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
| R3 | 2026-04-(마크다운 | 렌더링) |
| R15 | 2026-04-(skeleton) |  |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
