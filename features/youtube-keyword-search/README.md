# 유튜브 키워드 검색

> **상태**: stable | **카테고리**: ax-data | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 유튜브 키워드 검색

> YouTube에서 키워드별 추세, 경쟁도, 추천 콘텐츠 주제 분석

## 목적

트렌드 기반 콘텐츠 기획으로 최적의 키워드 발굴

## 사용자 시나리오

1. 콘텐츠 기획자가 'AI 마케팅' 키워드로 YouTube에서의 트렌드 검색
2. 시스템이 월간 검색량, 경쟁도, 추천 서브 키워드 제시
3. 관련 상위 콘텐츠 10개와 그들의 평균 조회수, 좋아요 비율 표시
4. 기획자가 최적의 키워드와 주제로 영상 기획

## 기술 스택

### 백엔드
- **서비스**: YoutubeKeywordSearchService
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/data/youtube/keyword-search | Required (JWT) |

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
