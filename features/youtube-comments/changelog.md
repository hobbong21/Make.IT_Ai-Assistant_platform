# 유튜브 댓글 분석 — 변경 이력

| 날짜 | 라운드 | 변경 내용 | 파일 |
|------|--------|---------|------|
| 2026-04-20 | R1 | 초기 구현 — YouTube 댓글 API 인터페이스 정의 | DataIntelligenceController, YoutubeCommentsService |
| 2026-04-24 | R7 | service-detail 페이지 통합 — 10개 서비스 자유 입력 지원 | service-detail.html, service-detail.js |
| 2026-04-26 | R18a | features/ 카탈로그 데이터 보강 — manifest.json, api.md, README, changelog 작성 | features/youtube-comments/ |

## 상태

- **v1.0.0** — Stable (2026-04-26 기준)
- 백엔드: API 구조 완성, Bedrock 통합 대기
- 프론트엔드: service-detail 페이지에서 완전 동작 중
- 테스트: E2E 스펙 작성 완료

## 주요 마일스톤

| 상태 | 항목 | 예상 시기 |
|------|------|---------|
| ✅ | DataIntelligenceController 정의 | R1 (2026-04-20) |
| ✅ | YoutubeCommentsService 인터페이스 | R1 (2026-04-20) |
| ✅ | 프론트엔드 UI 통합 | R7 (2026-04-24) |
| ✅ | API 명세 작성 | R18a (2026-04-26) |
| ⏳ | YouTube Data API v3 통합 | R{TBD} |
| ⏳ | Bedrock Claude 감정 분석 프롬프트 | R{TBD} |
| ⏳ | 비동기 작업 + Job lifecycle | R{TBD} |

## 알려진 문제

| 이슈 | 심각도 | 상태 | 설명 |
|------|--------|------|------|
| YouTube API 미연동 | 🟠 Major | Open | 현재는 stub 응답만 반환, 실제 댓글 수집 필요 |
| Bedrock 감정 분석 미완성 | 🟠 Major | Open | prompt 정의 및 RAG 벡터 저장소 필요 |
| 비동기 처리 미지원 | 🟡 Minor | Open | async=true 파라미터는 무시됨 |

## 다음 라운드 계획

### 우선순위 1: YouTube Data API 통합 (R{TBD})
- YouTube Data API v3 클라이언트 라이브러리 추가
- 댓글 수집 로직 구현
- API 할당량 관리

### 우선순위 2: Bedrock 감정 분석 (R{TBD})
- prompt 템플릿 정의 (prompts/youtube/comment-cluster.md)
- 클러스터링 로직 구현
- RAG 벡터 저장소 (pgvector) 연동

### 우선순위 3: 성능 최적화 (R{TBD})
- 댓글 대량 수집 시 배치 처리
- 캐싱 전략 (Redis)
- 비동기 작업 (JobService 통합)

## 관련 문서

- [README.md](./README.md) — 기능 설명
- [manifest.json](./manifest.json) — 파일 매핑
- [api.md](./api.md) — API 명세
- [R1 초기화 내용](#) — 아키텍처 설계
- [R7 service-detail 통합](#) — UI 개발
