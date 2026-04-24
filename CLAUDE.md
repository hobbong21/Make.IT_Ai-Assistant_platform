# MaKIT (Human.Ai.D AX 마케팅 플랫폼) — Claude Code 가이드

## 하네스: MaKIT 개발

**목표:** Spring Boot 백엔드·AWS Bedrock AI 통합·프론트엔드 API 연동·Docker/AWS 배포·통합 QA를 아우르는 MaKIT 플랫폼 개발을 에이전트 팀으로 완성한다.

**트리거:** MaKIT / AX 마케팅 플랫폼 / 백엔드 / AI 통합 / 프론트 연동 / 배포 / QA 관련 작업 요청 시 `makit-dev-orchestrator` 스킬을 사용하라. 단순 질문(문서·설계 확인 등)은 직접 응답 가능.

**실행 모드:** 에이전트 팀(Phase 3) + 서브 에이전트(Phase 2, 4, 5) 하이브리드. 모든 Agent 호출은 `model: "opus"`.

**팀 구성:**
- `architect` — 시스템 설계·API 계약·데이터 모델
- `backend-engineer` — Spring Boot 3.2 + Java 21 구현
- `ai-engineer` — AWS Bedrock + RAG 통합
- `frontend-engineer` — HTML/CSS/Vanilla JS API 연동
- `devops-engineer` — Docker + AWS ECS + CI/CD
- `qa-engineer` — 경계면 교차 비교 QA

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-20 | 초기 구성 | 전체 (6 agents + 6 skills + orchestrator) | MaKIT 프로젝트 개발 하네스 최초 구축 (3도메인 전체, 프론트 목업 → 프로덕션) |
| 2026-04-21 | v1 초기 빌드 완료 | backend/ (128 Java, 10 Flyway, 8 prompts), frontend/js/ (9 modules), docker-compose + CI/CD | 초기 실행 성공. QA 5 블로커 + 5 메이저 해소. 10/10 재검증 PASS. Phase 5 스모크 테스트 GO. |
| 2026-04-21 | 잔여 MINOR inline 해소 | docker-compose.yml, nginx.conf, .dockerignore | QA-M10(Redis env 와이어), QA-M14(actuator 내부망 제한), root 중복 dockerignore 추가 |
| 2026-04-21 | root 중복 파일 정리 | 9개 파일 삭제 (index/intro/login/all-services/service-detail .html + 4 CSS) | 사용자 승인. `frontend/` 정식 소스 확립. `0. Design1_Mokup/` 아카이브 보존. |
| 2026-04-21 | 운영 준비 라운드 완료 | backend (+5 Java: DemoUserSeeder/RateLimitFilter/DefaultS3ImageUploader/LoggingMdcFilter/prod-aws yml + pom deps), ai (실 스트리밍, PromptInjectionGuard, BedrockHealthIndicator, 버전닝), infra/terraform (9 모듈 35 파일, SNS+7알람+대시보드), 런북 §10-14 | PRR 1차 4 BLOCKER + 9 MAJOR → 수정 라운드 → 재검증 11/11 CONFIRMED FIXED. GO for `terraform apply`. |
| 2026-04-21 | tfstate 부트스트랩 스크립트 작성 | scripts/bootstrap-tfstate.{sh,ps1} | 사용자 머신에서 실행하도록 제공 (이 환경에 AWS CLI 없음). 멱등, 버전닝+SSE+public-block+HTTPS-only 정책, DynamoDB PAY_PER_REQUEST. |
| 2026-04-24 | D1 디자인 토큰 도입 (반응형 + a11y 베이스라인) | frontend/css/tokens.css 신설 (Royal Blue brand + Anthropic ref 토큰 + Pretendard Variable + 다크모드 페어 + WCAG focus-visible/skip-link/sr-only + 4px 그리드 + 3 브레이크포인트 sm/md/lg), common.css 갱신 (hardcoded → 토큰), 5 HTML(index/intro/login/all-services/service-detail) link 추가. 제안서 `_workspace/design/D1_Design_Tokens_Proposal.md`. | "반응형 디자인 부재 + 클로드디자인 참조 개선" 사용자 요청. Anthropic 자체 브랜드 실측 토큰(#1a1a1a/#737373/#e6e6e6, radius 10/14, shadow 0.05α)을 reference로 차용. D2(페이지 CSS 4종 토큰 적용) · D3(HTML 시맨틱+ARIA)는 다음 라운드. |
| 2026-04-24 | SVG illustration 시리즈 10종 도입 + broken 외부 이미지 11곳 교체 | frontend/img/illustrations/ 신설 (10 SVG, 총 ~46KB): hero 5종 (index/intro/login/all-services/service-detail) + 카테고리 3종 (ax-data/ax-marketing/commerce-brain) + 기능 2종 (feature-1/feature-2). 모든 SVG는 D1 토큰 색상 일관 사용, role="img" + title/desc로 a11y 충족, viewBox 기반 자연 반응형. index.html 4곳·intro.html 6곳에 외부 hurdlers.kr 이미지를 로컬 SVG로 일괄 교체. | 사용자 "각각에 이미지를 생성해서 적절하게 넣어줘" 요청. broken-link risk 완전 제거 + Anthropic 미니멀 톤 visual language 일관 + 페이지 가벼움(46KB ≪ 외부 PNG 1080w 평균 ~120KB×11) 세 마리 토끼. 페이지별 컨텍스트(자연어 분석, AI 챗봇, 검색광고/SEO/AEO 등)에 정확히 매핑된 시각 메타포 사용. |
