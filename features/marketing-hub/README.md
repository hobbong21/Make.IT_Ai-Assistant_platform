# 마케팅 허브

> 한 줄 설명: 캠페인/콘텐츠/일정/AI인사이트/채널성과를 단일 대시보드에서 통합 관리

## 목적

마케터의 단일 창(single pane of glass) — 캠페인 생성·편집·상태관리, 콘텐츠 라이브러리 CRUD, 7일 캘린더, AI 주간 인사이트(Bedrock), 4채널 성과 분석을 한 화면에서 완성.

## 사용자 시나리오

1. "마케팅 허브" 네비게이션 클릭
2. 요약 카드 4개 확인 (총 캠페인수, 활성캠페인, 이번주 계획, 성과)
3. 5상태 칸반 보드에서 캠페인 카드 클릭 → 편집 모달
4. "신규 캠페인" 버튼으로 DRAFT 캠페인 생성
5. 콘텐츠 라이브러리 그리드에서 기존 콘텐츠 재사용 또는 신규 추가
6. 7일 캘린더에서 일자 클릭 → 그 날 계획된 활동 확인
7. AI 주간 인사이트 마크다운 읽기 (Bedrock 생성)
8. 4채널(INSTAGRAM/YOUTUBE/SEO/ADS) 성과 라인차트로 트렌드 분석

## 기술 스택

### 백엔드
- **도메인**: `backend/src/main/java/com/humanad/makit/marketing/hub`
- **주요 클래스**:
  - `MarketingHubController` (GET /api/marketing/{hub,campaigns,contents,calendar/week,channels/performance})
  - `MarketingHubService`/`MarketingHubServiceImpl`
  - Campaign entity + enum (Status: DRAFT/SCHEDULED/ACTIVE/PAUSED/COMPLETED/ARCHIVED, Channel: INSTAGRAM/YOUTUBE/SEO/ADS/MULTI)
  - Content entity, CampaignRepository, ContentRepository
  - 6 DTO (HubSummaryResponse, CampaignDto, ContentDto, CalendarBucket, DailyMetric, ChannelPerformance)
  - WeeklyInsightService (audit_logs → Bedrock 프롬프트 → 인사이트 생성)
- **데이터**: campaigns, contents, audit_logs (성과 집계)
- **외부 API**: AWS Bedrock Claude Haiku (주간 인사이트)

### 프론트엔드
- **페이지**: `frontend/marketing-hub.html` (~520줄)
- **API 클라이언트**: `frontend/js/api.js::marketing.{hub,campaigns,contents,calendar,insightsWeekly,channelPerformance}`
- **컴포넌트**:
  - `frontend/js/pages/marketing-hub.js` (~320줄)
  - `frontend/js/pages/marketing-hub-campaign.js` (CRUD UI, 상태머신)
  - `frontend/js/pages/marketing-hub-content.js` (콘텐츠 그리드)
  - `frontend/js/modal.js` (편집/생성 모달)
  - `frontend/js/chatbot-widget.js` (마크다운 렌더링)
  - `frontend/js/skeleton.js` (로딩 상태)
- **스타일**: D1 토큰 100%, 모바일 반응형, Chart.js 4.4.0

### 테스트
- **E2E**: `tests/e2e/service.spec.ts` (J3 Marketing Hub journey: 캠페인 CRUD, 콘텐츠 추가, 인사이트 확인)

## API 계약

### REST 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | /api/marketing/hub | 허브 요약 (4 stat + stub) | required |
| POST | /api/marketing/campaigns | 캠페인 생성 | required |
| GET | /api/marketing/campaigns/{id} | 캠페인 조회 | required |
| PATCH | /api/marketing/campaigns/{id} | 캠페인 편집 | required |
| POST | /api/marketing/campaigns/{id}/status | 상태 변경 | required |
| DELETE | /api/marketing/campaigns/{id} | 캠페인 삭제 | required |
| POST | /api/marketing/contents | 콘텐츠 생성 | required |
| GET | /api/marketing/contents | 콘텐츠 목록 | required |
| PATCH | /api/marketing/contents/{id} | 콘텐츠 편집 | required |
| DELETE | /api/marketing/contents/{id} | 콘텐츠 삭제 | required |
| GET | /api/marketing/calendar/week?date=2026-04-26 | 7일 일정 | required |
| GET | /api/marketing/insights/weekly | AI 주간 인사이트 | required |
| GET | /api/marketing/channels/performance?days=30 | 채널별 성과 | required |

자세한 내용은 [api.md](./api.md) 참고.

## 의존성

### 내부 의존성
- auth (사용자 인증, 소유권 검증)
- audit (캠페인/콘텐츠 변경 로깅)
- ai (Bedrock 인사이트 생성)
- notifications (상태변경 알림 트리거)

### 외부 의존성
- AWS Bedrock Claude Haiku (주간 인사이트)
- PostgreSQL (캠페인/콘텐츠/감사로그)
- Redis (캐시)
- Chart.js 4.4.0 (성과 차트)

## 설정

### 환경 변수
```env
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
MARKETING_HUB_ENABLE_INSIGHTS=true
CACHE_ENABLED=true
```

### 마이그레이션
- `V{N}__create_campaigns.sql` — campaigns 테이블
- `V{N}__create_contents.sql` — contents 테이블
- `V{N}__create_channel_metrics.sql` — 채널별 성과 뷰

## 모니터링 & 로깅

- **메트릭**: 활성 캠페인 수, 콘텐츠 추가 속도, 인사이트 생성 시간
- **로그 레벨**: INFO (캠페인 CRUD), WARN (상태머신 위반 시도)
- **알림**: Bedrock 오류율 > 5% (CloudWatch)

## 변경 이력

최신 R 라운드별 이력은 [changelog.md](./changelog.md) 참고.

### 주요 마일스톤
- R6 (2026-04-25): 마케팅 허브 신설 (마스터 플랜 + 기본 구조)
- R7 (2026-04-25): 캠페인 CRUD + 상태머신 + Bedrock 인사이트
- R8 (2026-04-25): 콘텐츠 CRUD + 채널 metric 실수집 + WebSocket 실시간 알림
- R14a (2026-04-26): 캠페인 변경 알림 트리거 통합

## 참고 자료

- 아키텍처: `docs/architecture/marketing_hub_master_plan.md`
- 설계: `docs/design/D1_Design_Tokens_Proposal.md`
- 라운드 산출물: `docs/rounds/`
