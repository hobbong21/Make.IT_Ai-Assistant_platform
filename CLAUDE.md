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
