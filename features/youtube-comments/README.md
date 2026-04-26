# 유튜브 댓글 분석

> **상태**: stable | **카테고리**: ax-data | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 유튜브 댓글 분석

> YouTube 비디오의 댓글 데이터를 수집하고 AI 감정 분석 & 클러스터링

## 목적

마케터가 YouTube 채널의 댓글을 자동으로 분석하여 시청자의 감정, 의도, 주요 의견을 파악할 수 있도록 지원합니다. 이를 통해 콘텐츠 전략을 데이터 기반으로 개선할 수 있습니다.

## 사용자 시나리오

1. 마케터가 service-detail 페이지의 "유튜브 댓글 분석" 섹션에 YouTube 비디오 URL 입력
2. 시스템이 비디오 ID를 추출하고 백엔드에 요청 전달
3. YoutubeCommentsService가 Bedrock Claude를 사용하여 댓글 감정 분석 수행
4. 긍정/중립/부정 비율과 주요 의견 클러스터가 프론트엔드에 시각화됨
5. 마케터가 이를 바탕으로 다음 콘텐츠 기획에 반영

## 기술 스택

### 백엔드
- **도메인**: `com.humanad.makit.data.youtube`
- **주요 클래스**: `DataIntelligenceController` / `YoutubeCommentsService`
- **DTO**: `YoutubeCommentsRequest` (videoUrl, maxComments, async) / `YoutubeCommentsResponse`
- **AI**: AWS Bedrock Claude Haiku v1.0

### 프론트엔드
- **페이지**: `frontend/service-detail.html`
- **API 클라이언트**: `js/api.js` 의 `dataIntelligence.youtubeComments()`
- **로직**: `js/pages/service-detail.js` — SERVICE_META["youtube-comments"] 메타데이터 기반 동적 폼 생성
- **스타일**: D1 토큰 (Royal Blue 브랜드, Pretendard 폰트) 사용

### 테스트
- **E2E**: `tests/e2e/service.spec.ts`
- **범위**: URL 입력 → API 호출 → 결과 렌더링

## API 계약

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/data/youtube/comments` | YouTube 댓글 분석 요청 | Required (JWT) |

요청:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "maxComments": 100,
  "async": false
}
```

응답:
```json
{
  "videoId": "...",
  "totalComments": 150,
  "sentiment": {
    "positive": 0.65,
    "neutral": 0.20,
    "negative": 0.15
  },
  "themes": ["UI/UX feedback", "feature request"],
  "summary": "주요 사용자 피드백..."
}
```

## 의존성

### 내부 의존성
- `auth` — JWT 인증 필수
- `audit` — @Auditable 감시
- `jobs` — 비동기 작업 지원 (향후)

### 외부 의존성
- AWS Bedrock Claude 3.5 Haiku
- PostgreSQL (감정 분석 결과 저장)

## 설정

### 환경 변수
```env
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
```

## 모니터링 & 로깅

- **메트릭**: 요청 수, Bedrock 응답 시간 (평균<2s), sentiment 분포
- **로그 레벨**: INFO (정상 분석), WARN (비디오 ID 추출 실패)
- **알림**: Bedrock 한도 초과 시 @architecture Slack

## 변경 이력

| 라운드 | 날짜 | 변경 내용 |
|--------|------|----------|
| R1 | 2026-04-20 | 초기 구현 — YouTube 댓글 API 인터페이스 정의 |
| R7 | 2026-04-24 | service-detail 페이지에 통합 — 10개 서비스 자유 입력 지원 |

상세한 내용은 [changelog.md](./changelog.md) 참고.

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 설계: `docs/design/D1_Design_Tokens_Proposal.md`
- 라운드 산출물: `docs/rounds/`
