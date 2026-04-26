# MaKIT 마케팅 허브 마스터 플랜

## 비전: 완벽한 마케팅 지원 플랫폼

마케터가 **하루의 첫 시작**에서 모든 마케팅 업무의 핵심을 한 화면(**Single Pane of Glass**)에서 관리할 수 있는 통합 대시보드. 캠페인 진행, 콘텐츠 자산 관리, 일정 추적, AI 인사이트, 다중 채널 성과를 모두 포함.

---

## 5 핵심 영역

### 1. 캠페인 관리 (Campaign Management)
**상태 머신**: DRAFT → SCHEDULED → ACTIVE → PAUSED → COMPLETED

- **역할**: 마케팅 캠페인의 생명주기 시각화
- **기능**:
  - 칸반 보드 (5개 컬럼): 상태별 캠페인 카드
  - 각 카드: 캠페인명 + 생성일 + 타겟 채널 + 예산 표시
  - 드래그앤드롭으로 상태 전환 (MVP에서는 표시만, 다음 단계에서 상호작용)
  - 클릭 시 캠페인 상세 페이지로 이동

**데이터 모델**:
```sql
campaigns (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50) CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED')),
  channels VARCHAR[] DEFAULT ARRAY[]::VARCHAR[] -- ['instagram', 'youtube', 'email']
  budget DECIMAL(10,2),
  startAt TIMESTAMP,
  endAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
)
```

### 2. 콘텐츠 라이브러리 (Content Library)
**역할**: 10개 서비스에서 생성된 모든 콘텐츠를 메타데이터와 함께 통합 관리

- **기능**:
  - 그리드 뷰 (4-6개 항목): 최근 생성 콘텐츠
  - 각 아이템: 썸네일 + 타입 + 생성 서비스 + 생성일자 + 해상도/길이 정보
  - 타입별 아이콘: 🎨 이미지, 📄 텍스트, 🎬 비디오, 🔊 오디오
  - 필터: 모든 서비스 / AX Data / AX Marketing / AX Commerce
  - 클릭 시 서비스 상세 페이지로 이동 (직접 재생성 가능)

**데이터 모델**:
```sql
contents (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  serviceKey VARCHAR(50) NOT NULL, -- 'feed-generate', 'remove-bg', etc.
  contentType VARCHAR(50), -- 'IMAGE', 'TEXT', 'VIDEO', 'AUDIO'
  title VARCHAR(255),
  description TEXT,
  thumbnailUrl VARCHAR(2048),
  contentUrl VARCHAR(2048),
  metadata JSONB, -- { aspectRatio: '1080x1080', duration: 30, fileSize: '2.5MB' }
  createdAt TIMESTAMP DEFAULT NOW(),
  createdAt TIMESTAMP DEFAULT NOW()
)
```

### 3. 캘린더 뷰 (Calendar View)
**역할**: 캠페인 발행 일정 + 콘텐츠 발행 예정을 시간축으로 시각화

- **기능**:
  - 7일 히트맵 (월-일): 각 일자별 예정 아이템 개수
  - 색상 강도: 예정된 작업 많을수록 짙은 색
  - 일자 클릭 시 그 날의 예정 항목 모달로 표시
  - 우측 요약: 이번 주 총 발행 일정, 가장 바쁜 날

**데이터 모델**:
```sql
scheduled_posts (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  contentId UUID REFERENCES contents(id),
  campaignId UUID REFERENCES campaigns(id),
  scheduledAt TIMESTAMP NOT NULL,
  channel VARCHAR(50), -- 'instagram', 'youtube', 'email'
  createdAt TIMESTAMP DEFAULT NOW()
)
```

### 4. 주간 AI 인사이트 (Weekly AI Insights)
**역할**: Bedrock Claude를 통해 지난 주 데이터를 분석해 자동 생성되는 리포트

- **기능**:
  - 마크다운 렌더링: 제목, 목록, 코드 블록, 링크 포함
  - 섹션:
    - 📊 이번 주 요약 (발행 횟수, 총 도달, 클릭율)
    - 🎯 최고 성과 콘텐츠 (Top 3)
    - 📈 성장 기회 (약점 분석)
    - 💡 다음 주 추천 (AI 제안)
  - 새로고침 버튼: 수동으로 리포트 재생성
  - 시간 표시: "수요일 오전 10시 생성됨"

**데이터 모델**:
```sql
marketing_insights (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  weekStartAt DATE,
  weekEndAt DATE,
  insightMarkdown TEXT,
  generatedAt TIMESTAMP DEFAULT NOW()
)
```

### 5. 다중 채널 성과 (Multi-Channel Performance)
**역할**: Instagram, YouTube, SEO, 광고 성과를 한 화면에서 비교 분석

- **기능**:
  - 4개 채널 카드 (또는 탭): Instagram / YouTube / SEO / 광고
  - 각 카드:
    - 주요 KPI 3-4개 (도달, 클릭, 전환율, ROI)
    - 30일 라인 차트 (Chart.js): 일일 추이
    - 전월 대비 변화율 (% 표시, 상승/하강 화살표)
  - 채널별 색상 일관성 (D1 토큰)

**데이터 모델**:
```sql
channel_performance (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  channel VARCHAR(50) NOT NULL,
  dateAt DATE NOT NULL,
  impressions BIGINT,
  clicks BIGINT,
  conversions BIGINT,
  revenue DECIMAL(10,2),
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(userId, channel, dateAt)
)
```

---

## MVP → 완성형 로드맵

| 영역 | MVP (이번 라운드) | 다음 라운드 (R4) | 장기 (R5+) |
|------|-----------------|----------------|----------|
| **캠페인 관리** | 칸반 보드 UI + stub 데이터 | 실제 campaigns 테이블 쿼리 + 드래그앤드롭 상태 전환 | 일정 예약, 예산 추적, A/B 테스트 결과 연동 |
| **콘텐츠 라이브러리** | 그리드 UI + 최근 5개 콘텐츠 조회 | contents 테이블 JOIN (serviceKey) + 필터 | 태그, 검색, 즐겨찾기, 버전 관리 |
| **캘린더** | 7일 히트맵 (stub) | scheduled_posts 쿼리 + 일자별 모달 | 드래그 스케줄링, 충돌 감지, 타임존 지원 |
| **AI 인사이트** | 마크다운 렌더 UI + stub 텍스트 | 실제 marketing_insights 쿼리 + 주간 자동 생성 배치 | 사용자 정의 리포트, PDF 내보내기, Slack 푸시 |
| **채널 성과** | 4 카드 + Chart.js 차트 UI | channel_performance 쿼리 + 30일 실제 데이터 | 채널 추가/삭제, 벤치마크 비교, 예측 분석 |

---

## 백엔드 API 계약 (MVP)

### 1. GET /api/marketing/hub
**요약 데이터** (대시보드 상단 4개 카드)

```json
{
  "activeCampaigns": 3,
  "totalContents": 27,
  "scheduledThisWeek": 5,
  "avgPerformance": 68,
  "lastUpdatedAt": "2026-04-25T10:30:00Z"
}
```

**구현**: DashboardService.java에 메서드 추가 또는 별도 MarketingHubController.java 신설
- activeCampaigns: COUNT(*) FROM campaigns WHERE userId = ? AND status IN ('SCHEDULED', 'ACTIVE')
- totalContents: COUNT(*) FROM contents WHERE userId = ?
- scheduledThisWeek: COUNT(*) FROM scheduled_posts WHERE userId = ? AND scheduledAt >= NOW() - INTERVAL 7 DAY
- avgPerformance: ROUND(AVG(revenue / NULLIF(impressions, 0)) * 100) FROM channel_performance (또는 stub: 68)

### 2. GET /api/marketing/campaigns?status=ACTIVE
**캠페인 목록** (칸반 보드)

```json
{
  "draft": [
    { "id": "...", "name": "봄 시즌 프로모션", "channels": ["instagram"], "budget": 500000, "createdAt": "2026-04-20" }
  ],
  "scheduled": [...],
  "active": [...],
  "paused": [...],
  "completed": [...]
}
```

**구현**: CampaignRepository.findByUserIdAndStatus() 또는 findByUserId()로 목록 조회, 상태별 그룹화

### 3. GET /api/marketing/contents?limit=6
**콘텐츠 최근 목록** (콘텐츠 라이브러리 그리드)

```json
{
  "contents": [
    {
      "id": "...",
      "title": "여름 인스타 피드 v1",
      "serviceKey": "feed-generate",
      "contentType": "IMAGE",
      "thumbnailUrl": "/uploads/...",
      "metadata": { "aspectRatio": "1080x1080", "fileSize": "2.5MB" },
      "createdAt": "2026-04-25T09:15:00Z"
    }
  ]
}
```

**구현**: ContentRepository.findByUserIdOrderByCreatedAtDesc(Pageable) 쿼리 추가

### 4. GET /api/marketing/calendar/week
**주간 일정** (캘린더 히트맵)

```json
{
  "buckets": [
    { "dateString": "2026-04-28", "count": 2, "items": ["캠페인1 발행", "피드 업로드"] },
    { "dateString": "2026-04-29", "count": 0 },
    ...
  ]
}
```

**구현**: scheduled_posts 테이블 쿼리, 날짜별 집계

### 5. GET /api/marketing/insights/weekly
**주간 AI 인사이트** (마크다운)

```json
{
  "id": "...",
  "weekStartAt": "2026-04-21",
  "weekEndAt": "2026-04-27",
  "insightMarkdown": "# 이번 주 마케팅 성과\n\n## 📊 요약\n...",
  "generatedAt": "2026-04-25T08:00:00Z"
}
```

**구현**:
- MarketingInsightRepository.findLatestByUserId()
- InsightGenerationService.generateWeeklyInsight() (Bedrock Claude 호출, 기존 ChatbotEngine 재사용)
- Fallback stub: hardcoded markdown 텍스트 ("## 이번 주 성과\n\n- 발행 5회\n- 총 도달 12,300\n...")

### 6. GET /api/marketing/channels/performance?days=30
**채널별 성과** (차트 데이터)

```json
{
  "channels": [
    {
      "channel": "instagram",
      "data": [
        { "date": "2026-03-26", "impressions": 1200, "clicks": 45, "conversions": 3, "revenue": 125000 },
        ...
      ],
      "summary": {
        "totalImpressions": 36000,
        "totalClicks": 1350,
        "totalConversions": 89,
        "totalRevenue": 3750000,
        "changePercent": 12.5
      }
    },
    ...
  ]
}
```

**구현**: ChannelPerformanceRepository.findByUserIdAndChannelAndDateBetween() 쿼리

---

## 프론트엔드 구조

### 파일 목록
1. **frontend/marketing-hub.html** (~350줄)
   - 5 섹션 레이아웃 (요약 카드 + 캠페인 보드 + 콘텐츠 그리드 + 캘린더 + 인사이트 + 채널 성과)
   - D1 토큰 기반 CSS inline (~150줄)
   - 로딩 스크립트 순서 정의

2. **frontend/js/pages/marketing-hub.js** (~250줄)
   - init() / renderSummaryCards() / renderCampaignBoard() / renderContentLibrary()
   - renderCalendar() / renderInsights() / renderChannelChart()
   - 모든 fetch 시 catch → graceful degradation

3. **frontend/js/api.js** 수정 (~20줄 추가)
   - api.marketing.hub()
   - api.marketing.campaigns()
   - api.marketing.contents()
   - api.marketing.channelPerformance()

4. **frontend/index.html** 수정
   - sidebar nav-section "홈"에 "마케팅 허브" 링크 추가

5. **frontend/js/app-shell-extras.js** 수정
   - PAGES 배열에 { url: 'marketing-hub.html', name: '마케팅 허브', icon: '🎯' } 추가

---

## 디자인 원칙

- **D1 토큰 100% 사용**: --mk-color-*, --mk-space-*, --mk-radius-*, --mk-font-*
- **다크모드 지원**: CSS variables 활용, data-theme 속성 응답
- **모바일 반응형**: CSS Grid + clamp() 함수, 3 브레이크포인트 (sm/md/lg)
- **접근성**: ARIA labels, role, aria-live, alt 텍스트, 포커스 스타일
- **에러 처리**: 모든 API fetch catch → fallback UI (빈 상태, 에러 메시지, 재시도 버튼)
- **한국어**: 모든 UI 텍스트 및 메시지 한국어

---

## 구현 우선순위

### 이번 라운드 (R3)
1. HTML 레이아웃 (5 섹션)
2. 기본 CSS (D1 토큰, 반응형 그리드)
3. Stub API 호출 + Fallback 렌더
4. 네비게이션 링크 추가

### 다음 라운드 (R4)
1. 백엔드 endpoints 구현 (6개 API)
2. MarketingInsight 자동 생성 배치
3. 칸반 보드 드래그앤드롭
4. 캘린더 일자별 모달

### 장기 (R5+)
1. 고급 필터링 (캠페인/콘텐츠)
2. 내보내기 (PDF 리포트)
3. 웹훅 통합 (외부 마케팅 도구)
4. 라이브 메트릭 (실시간 업데이트)

---

## 기술 스택

- **프론트**: HTML5 + CSS Grid + Vanilla JS (D1 토큰)
- **차트**: Chart.js v4 (CDN)
- **마크다운 렌더**: chatbot.js의 renderMarkdown() 활용 (또는 inline 구현)
- **백엔드**: Spring Boot 3.2 + Flyway + PostgreSQL
- **AI**: AWS Bedrock Claude (주간 인사이트)

---

## 성공 기준

- [ ] 마케팅 허브 페이지 로드 시 5개 섹션 모두 UI 표시
- [ ] 모든 API 호출 실패 시 graceful fallback (빈 상태/에러 메시지)
- [ ] 모바일 / 태블릿 / 데스크톱 반응형 동작
- [ ] WCAG AA 접근성 준수
- [ ] 마케터 관점: "내 일주일 계획을 한 화면에서 본다"는 느낌

---

**최종 비전**: MaKIT은 단순한 AI 서비스 포장재가 아니라, **마케터의 진정한 일 친구**. 캠페인 기획 → 콘텐츠 생성 → 발행 일정 → 성과 분석까지 모든 단계를 통합하여, 마케터가 "다음 무엇을 해야 할까?"에 대한 명확한 답변을 얻을 수 있는 플랫폼.
