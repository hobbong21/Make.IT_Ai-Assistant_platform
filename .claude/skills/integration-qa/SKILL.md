---
name: integration-qa
description: "MaKIT 통합 QA 가이드. 경계면 교차 비교(API↔Frontend, AI↔Backend, DB↔Entity, Docker↔런타임), 체크리스트, 버그 패턴 카탈로그, 통합 테스트 작성. 'QA', '통합 테스트', '경계 검증', 'API 응답 검증', '버그 찾기', '테스트 작성' 요청 시 반드시 이 스킬을 사용할 것."
---

# Integration QA — 경계면 교차 비교

## 핵심 아이디어

모듈은 각자 보면 다 멀쩡하고, **경계에서 터진다**. 이 스킬은 "한 쪽만 보지 말고 양쪽을 동시에 열어 필드별로 대조"하는 방법론을 제공한다.

## 5개 경계 + 체크리스트

### 경계 1: Backend API ↔ Frontend

**동시에 열 파일**:
- `backend/src/main/java/com/humanad/makit/{domain}/*Controller.java`
- `backend/src/main/java/com/humanad/makit/{domain}/dto/*.java`
- `frontend/js/api.js`
- `frontend/js/pages/{page}.js`

**대조표 템플릿** (`_workspace/06_qa_report_{date}.md`에 작성):

| 엔드포인트 | Backend (Controller) | Frontend (api.js) | 일치 |
|----------|---------------------|-------------------|------|
| POST /api/auth/login | req: LoginRequest{email,password}, res: LoginResponse{token,user} | req: {email,password}, 사용: data.token, data.user | ✅ |
| POST /api/data/nlp/analyze | req: {text:String} | req: {text} | ✅ |
| ... | | | |

**반드시 확인**:
- [ ] 경로 정확히 일치 (`/api/data/nlp/analyze` vs `/data/nlp/analyze` 흔한 실수)
- [ ] 메서드 (POST/GET/PUT)
- [ ] 요청 body 필드명·타입
- [ ] 응답 필드명 (camelCase 유지, snake_case 혼입 금지)
- [ ] 응답 null 처리 (프론트가 optional chaining 쓰는가)
- [ ] 에러 응답 (`ApiErrorResponse` 구조로 통일)
- [ ] HTTP 상태 코드 (201 Created vs 200 OK)
- [ ] Pagination 규약 통일 (`page,size,totalElements,content`)

### 경계 2: AI ↔ Backend

**동시에 열 파일**:
- `backend/src/main/resources/prompts/{domain}/{task}.md` (프롬프트)
- `backend/src/main/java/com/humanad/makit/ai/bedrock/BedrockService.java`
- `backend/src/main/java/com/humanad/makit/ai/content/*.java` (Strategy 구현체)

**반드시 확인**:
- [ ] 프롬프트가 요구하는 출력 JSON schema == Java 파서가 기대하는 구조
- [ ] Claude vs Titan 응답 포맷 분기 처리 (content 배열 vs text 필드)
- [ ] 토큰 한도 초과 시 처리 (잘라서 재시도 또는 요약 후 재시도)
- [ ] 프롬프트 변수 `{{...}}` 가 모두 주입됨 (미주입 변수 남으면 실패)
- [ ] 인젝션 방지: 사용자 입력을 `<user_input>` 태그로 감쌌는가

### 경계 3: DB ↔ Entity

**동시에 열 파일**:
- `backend/src/main/resources/db/migration/V*.sql`
- `backend/src/main/java/com/humanad/makit/{domain}/domain/*.java`

**반드시 확인**:
- [ ] 컬럼명 == `@Column(name=)` (snake_case ↔ camelCase 매핑)
- [ ] NULLABLE 일관성 (`NOT NULL` vs `nullable = false`)
- [ ] 길이 (`VARCHAR(255)` vs `length = 255`)
- [ ] Enum 저장: `@Enumerated(EnumType.STRING)` + VARCHAR (Ordinal 금지)
- [ ] FK cascade 정책 vs JPA cascade
- [ ] 인덱스: 자주 WHERE에 쓰는 컬럼에 DB 인덱스 있는가
- [ ] `created_at`, `updated_at`, `version` 컬럼 존재 및 auditing

### 경계 4: Docker ↔ 런타임

**동시에 열 파일**:
- `docker-compose.yml`
- `backend/src/main/resources/application.yml` / `application-docker.yml`
- `backend/Dockerfile`

**반드시 확인**:
- [ ] 환경변수 이름 일치 (`SPRING_DATASOURCE_URL` 등)
- [ ] 포트 매핑 (`8080:8080` vs `server.port`)
- [ ] 서비스 DNS (`jdbc:postgresql://database:5432/...` vs compose 서비스명 `database`)
- [ ] healthcheck 실제 통과 (Spring Actuator 엔드포인트 활성화)
- [ ] `depends_on: condition: service_healthy` 설정
- [ ] 시크릿이 이미지에 굽히지 않음 (`docker history`로 검증)
- [ ] 로그 레벨이 prod에서 DEBUG가 아님

### 경계 5: Nginx ↔ Backend

**동시에 열 파일**:
- `nginx.conf` (또는 루트 `Dockerfile` 내 설정)
- `backend/src/main/java/com/humanad/makit/config/SecurityConfig.java` (CORS 등)
- `backend/src/main/java/com/humanad/makit/*Controller.java` (`@RequestMapping`)

**반드시 확인**:
- [ ] `location /api/ { proxy_pass http://backend:8080/api/; }` — 끝 슬래시 주의
- [ ] SSE 스트리밍 경로는 `proxy_buffering off`
- [ ] `proxy_read_timeout`가 AI 호출 시간보다 길다 (최소 120s)
- [ ] CORS: Nginx가 proxy하면 백엔드에서 CORS 허용 불필요 (same-origin). 만약 도메인 분리 시 백엔드에 Origin 화이트리스트.
- [ ] WebSocket이 필요하면 `proxy_http_version 1.1` + Upgrade 헤더

## 버그 패턴 카탈로그

`_workspace/06_qa_bug_patterns.md`에 발견한 패턴을 누적. 예시:

### BP-001: camelCase ↔ snake_case 불일치
- **증상**: 프론트에서 `data.userName` 이 undefined
- **원인**: Controller DTO는 camelCase인데 Jackson 설정이 SNAKE_CASE naming strategy
- **방지**: `spring.jackson.property-naming-strategy` 미설정 (기본 LOWER_CAMEL_CASE) + 전 DTO에 명시

### BP-002: Enum Ordinal 저장
- **증상**: 새 Enum 값 중간 삽입 후 기존 데이터의 의미가 틀어짐
- **원인**: `@Enumerated(EnumType.ORDINAL)` 기본값
- **방지**: 모든 Enum에 `@Enumerated(EnumType.STRING)` 명시

### BP-003: 프록시 타임아웃으로 AI 응답 유실
- **증상**: 30초 넘는 요청에서 502
- **원인**: Nginx 기본 `proxy_read_timeout 60s`
- **방지**: `/api/` location에 `proxy_read_timeout 120s` + backend `server.tomcat.connection-timeout`도 조정

(이하 프로젝트 진행하며 추가)

## 통합 테스트 (재발 방지)

버그 패턴마다 한 줄 이상의 테스트로 방어:

```java
// 경계 1 예시: Controller ↔ DTO schema
@WebMvcTest(AuthController.class)
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @MockBean AuthService authService;

    @Test
    void login_responseShape() throws Exception {
        given(authService.login(any())).willReturn(
            new LoginResponse("tok", new UserDto(1L, "a@b.c", "ADMIN")));

        mvc.perform(post("/api/auth/login")
                .contentType(APPLICATION_JSON)
                .content("""
                    {"email":"a@b.c","password":"password123"}
                """))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.token").exists())
           .andExpect(jsonPath("$.user.email").value("a@b.c"))
           .andExpect(jsonPath("$.user.role").value("ADMIN"));  // camelCase 고정
    }
}
```

```java
// 경계 3 예시: Repository ↔ DB
@DataJpaTest
@Testcontainers
class UserRepositoryTest {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:15-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }

    @Autowired UserRepository repo;

    @Test
    void persist_roleAsString() {
        User u = new User(); u.setEmail("x@y.z"); u.setRole(UserRole.ADMIN);
        u.setPasswordHash("...");
        User saved = repo.save(u);
        assertThat(saved.getId()).isNotNull();
        // 네이티브 쿼리로 DB에 실제 VARCHAR로 저장됐는지 확인
        ...
    }
}
```

## 스모크 테스트 시나리오 (전체 스택)

`_workspace/06_qa_smoke_{date}.md`:

1. `docker-compose up -d` → 모든 서비스 healthy 5분 내
2. `POST /api/auth/login` with demo@Human.Ai.D.com → 200 + 토큰
3. `GET /api/auth/me` with 토큰 → 200 + user role=ADMIN
4. `POST /api/data/nlp/analyze` with {"text":"..."} → 200 + 결과 JSON
5. `POST /api/commerce/chatbot/message` → 200 + 응답
6. `POST /api/marketing/feed/generate` → 200 + 생성 이미지 URL (S3)
7. 프론트 브라우저: login → index → all-services → service-detail → 예시 질문 클릭 → 결과 렌더
8. 로그아웃 → `GET /api/auth/me` → 401 → login 페이지 리다이렉트

각 단계에서 실패하면 어느 경계인지 즉시 특정.

## 버그 리포트 템플릿

```markdown
## Bug: {한 줄 제목}

- **경계**: {API↔FE | AI↔BE | DB↔Entity | Docker↔런타임 | Nginx↔BE}
- **발견자**: qa-engineer
- **심각도**: {Blocker|Major|Minor}
- **담당**: {architect|backend-engineer|ai-engineer|frontend-engineer|devops-engineer}

### 재현 스텝
1. ...
2. ...

### 기대 동작
...

### 실제 동작
...

### 증거
- 파일/라인: `backend/.../FooController.java:42`
- 응답 샘플: ```json ... ```
- 로그: ```... ```

### 제안 수정 (선택)
...
```

## 금지 사항

- QA가 직접 프로덕션 코드 수정 (경계 위반)
- "한 번 돌려봤더니 되더라"식의 검증 (구조적 대조 없음)
- 테스트 없이 버그 fix만 (재발 방지 실패)
- 실제 Bedrock 호출하는 테스트 (CI 비용/flaky) — 반드시 mock

## 참조

- 원본 하네스의 qa-agent-guide.md 7개 버그 사례
- Testcontainers: https://java.testcontainers.org
- RestAssured: https://rest-assured.io
