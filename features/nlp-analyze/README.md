# NLP 자연어 분석

> 한 줄 설명: 사용자 텍스트를 AWS Bedrock Claude AI로 분석하여 감정, 키워드, 의도 등을 추출

## 목적

마케팅/이커머스 팀이 텍스트 데이터(고객 피드백, 리뷰, 댓글)를 자동으로 분석하여 비즈니스 인사이트를 빠르게 확보할 수 있도록 지원.

## 사용자 시나리오

1. "모든 서비스" 페이지에서 "자연어 분석" 서비스 선택
2. 텍스트 입력 (자유 텍스트, 최대 2000자)
3. "분석" 버튼 클릭
4. Bedrock Claude가 감정(긍정/부정/중립), 주제, 액션 아이템 분석
5. 마크다운 형식의 결과 렌더링
6. CSV 다운로드 또는 히스토리에 저장

## 기술 스택

### 백엔드
- **도메인**: `backend/src/main/java/com/humanad/makit/data/nlp`
- **주요 클래스**: 
  - `DataIntelligenceController` (POST /api/data/nlp-analyze)
  - `NlpService`/`NlpServiceImpl`
  - `NlpAnalysisRequest`/`NlpAnalysisResponse` (DTO)
- **AI**: AWS Bedrock Claude Haiku Converse API
- **외부 API**: Bedrock (en-US 프롬프트)

### 프론트엔드
- **페이지**: `frontend/service-detail.html`
- **API 클라이언트**: `frontend/js/api.js::data.nlpAnalyze()`
- **컴포넌트**: `frontend/js/pages/service-detail.js` (SERVICE_META["nlp-analyze"])
- **스타일**: `frontend/css/service-detail-styles.css` (D1 토큰)

### 테스트
- **E2E**: `tests/e2e/service.spec.ts` (J2 Service journey)

## API 계약

### REST 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/data/nlp-analyze | 텍스트 감정/의도 분석 | required |

자세한 내용은 [api.md](./api.md) 참고.

## 의존성

### 내부 의존성
- auth (JWT 인증)
- audit (사용 로깅)
- job (비동기 작업 추적)

### 외부 의존성
- AWS Bedrock Claude Haiku (AI 분석)
- PostgreSQL (결과 저장)

## 설정

### 환경 변수
```env
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
```

### 마이그레이션
- Flyway는 audit_logs 테이블만 사용 (별도 테이블 미생성)

## 모니터링 & 로깅

- **메트릭**: /api/data/nlp-analyze 호출 횟수, 평균 응답시간
- **로그 레벨**: INFO (분석 시작/완료), WARN (Bedrock 오류 시 fallback)
- **알림**: Bedrock 오류율 > 5% (CloudWatch)

## 변경 이력

최신 R 라운드별 이력은 [changelog.md](./changelog.md) 참고.

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 프롬프트: `backend/src/main/resources/prompts/nlp-analyze-prompt.txt`
- 라운드 산출물: `docs/rounds/`
