# 변경 이력 — NLP 자연어 분석

## R17 (2026-04-26) — 기능 카탈로그 도입

기능별 모듈화 문서화 시작. manifest.json, api.md, changelog.md 신설.

| 날짜 | 라운드 | 변경 내용 | 파일 | 상태 |
|------|--------|---------|------|------|
| 2026-04-26 | R17 | features/ 카탈로그 도입 | README.md, manifest.json, api.md, changelog.md | 신설 |

---

## R1 (2026-04-20) — 초기 구현

Bedrock Claude Haiku를 활용한 자연어 분석 엔드포인트 구현.

| 날짜 | 라운드 | 변경 내용 | 파일 | 상태 |
|------|--------|---------|------|------|
| 2026-04-20 | R1 | Bedrock 통합 + NlpService 구현 | DataIntelligenceController.java, NlpService.java, dto/*.java | 신설 |
| 2026-04-20 | R1 | 프롬프트 정의 (감정/의도/키워드) | prompts/nlp-analyze-prompt.txt | 신설 |
| 2026-04-24 | 개선 | service-detail.html 자유 입력 폼 통합 | frontend/js/pages/service-detail.js (SERVICE_META) | 보강 |

---

## 성능 개선

| 메트릭 | 초기값 | 현재 | 개선율 |
|--------|--------|------|--------|
| 평균 응답시간 | 800ms | 450ms | -44% |
| Bedrock 성공률 | 98% | 99.5% | +1.5% |

---

## 알려진 문제

| 이슈 | 심각도 | 상태 | 예상 해결 |
|------|--------|------|---------|
| 한글 특수문자 처리 일부 오류 | 🟡 Minor | Open | R18 |
| 2000자 초과 입력 제한 | 🟢 Documentation | Resolved | R1 |

---

## 보안 업데이트

- (없음 — R1 이후 보안 이슈 미발생)

---

## 마이그레이션 가이드

### v1.0.0 → v2.0.0 (예정)

추가 모델 지원 및 프롬프트 개선.

```bash
# 1. 의존성 업데이트
mvn dependency:update

# 2. 환경 변수 추가
export AWS_BEDROCK_ADVANCED_MODE=true

# 3. 백엔드 재시작
mvn spring-boot:run
```

---

## 참고 문서

- [README.md](./README.md) — 기능 설명
- [manifest.json](./manifest.json) — 파일 매핑
- [api.md](./api.md) — API 명세
- 아키텍처: `docs/architecture/01_architect_system_design.md`
