---
name: spring-boot-backend
description: "MaKIT 백엔드 Spring Boot 3.2 + Java 21 프로젝트 스캐폴딩 및 구현 가이드. 모듈 구조, JPA Entity, Controller/Service/Repository 패턴, JWT 인증, 예외 처리, 테스트 작성법. Spring Boot·JPA·Java 백엔드·API·Controller·Entity·JWT·인증·Repository 작업 요청 시 반드시 이 스킬을 사용할 것. 'backend 구현', '백엔드 개발', 'API 추가', '엔드포인트 만들어', 'Spring Boot 설정' 등 트리거."
---

# Spring Boot Backend — MaKIT 백엔드 구현 가이드

## 언제 사용하나

- 신규 Spring Boot 프로젝트 스캐폴딩 (`backend/` 디렉토리 생성)
- 새 REST API 엔드포인트 추가
- JPA Entity + Repository + Service + Controller 레이어 작성
- JWT 인증 설정, 예외 처리, Validation
- 통합/단위 테스트 작성

## 기술 스택 고정

- **Java 21** (record, pattern matching, virtual threads 활용 가능)
- **Spring Boot 3.2.0** (Spring Framework 6, Jakarta EE 10)
- **Spring Data JPA** + **Hibernate 6**
- **PostgreSQL 15** (prod), **H2** (test)
- **Redis** (캐싱·세션)
- **Flyway** (DB 마이그레이션)
- **Spring Security 6** + **jjwt 0.12.x** (JWT)
- **springdoc-openapi 2.x** (Swagger UI)
- **JUnit 5** + **Mockito 5** + **AssertJ**
- **MapStruct 1.5.x** (DTO↔Entity 매핑)

## 표준 모듈 구조

```
backend/src/main/java/com/humanad/makit/
├── MaKITApplication.java
├── config/
│   ├── SecurityConfig.java         (Spring Security + JWT 필터)
│   ├── BedrockConfig.java          (Bedrock Client Bean)
│   ├── RedisConfig.java
│   ├── OpenApiConfig.java          (Swagger)
│   └── AsyncConfig.java            (virtual threads 기반 Executor)
├── common/
│   ├── ApiErrorResponse.java       (record)
│   ├── MarKITException.java        (base)
│   ├── GlobalExceptionHandler.java (@ControllerAdvice)
│   └── PageResponse.java           (pagination 통일)
├── auth/
│   ├── AuthController.java
│   ├── AuthService.java / AuthServiceImpl.java
│   ├── JwtTokenProvider.java
│   ├── JwtAuthenticationFilter.java
│   ├── UserDetailsServiceImpl.java
│   ├── dto/ (LoginRequest, LoginResponse, RegisterRequest)
│   └── domain/ (User entity, UserRepository, UserRole enum)
├── data/                            # AX Data Intelligence
│   ├── DataIntelligenceController.java
│   ├── nlp/ (service + dto)
│   ├── youtube/ (comments, influence, keyword-search)
│   └── url/
├── marketing/                       # AX Marketing Intelligence
│   ├── MarketingIntelligenceController.java
│   ├── feed/ (Instagram feed generation)
│   └── image/ (background removal)
└── commerce/                        # AX Commerce Brain
    ├── CommerceBrainController.java
    ├── chatbot/ (RAG 연동, ConversationContext Entity)
    ├── review/ (sentiment, summarization)
    └── modelshot/ (image composition)
```

## 명명/코딩 규칙

### DTO = Java record
```java
public record LoginRequest(
    @Email @NotBlank String email,
    @NotBlank @Size(min = 8) String password
) {}

public record ApiErrorResponse(
    String errorCode,
    String message,
    String details,
    LocalDateTime timestamp,
    String requestId,
    Map<String, Object> metadata
) {}
```

### Entity는 class + JPA
```java
@Entity
@Table(name = "users", indexes = @Index(name = "idx_users_email", columnList = "email"))
@Getter @Setter  // Lombok 허용
@NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 255)
    private String email;
    
    @Enumerated(EnumType.STRING)
    private UserRole role;
    // ...
}
```

### Service 인터페이스 + 구현 분리
```java
public interface AuthService {
    LoginResponse login(LoginRequest request);
}

@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepo;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider jwtProvider;
    // ...
}
```

### Controller — 얇게
```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }
}
```

## JWT 표준 구현

- 토큰 구조: `{sub: userId, email, role, iat, exp}` — exp 1시간, refresh 7일
- 서명: HS256 + `JWT_SECRET` 환경변수 (최소 256비트)
- 필터: `JwtAuthenticationFilter extends OncePerRequestFilter`
- `Authorization: Bearer <token>` 파싱 → `SecurityContextHolder` 세팅
- 401 응답은 `AuthenticationEntryPoint`로 `ApiErrorResponse` 포맷 유지

## 예외 처리 계약

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(...) { return 400; }
    
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuth(...) { return 401; }
    
    @ExceptionHandler(MarKITException.class)
    public ResponseEntity<ApiErrorResponse> handleBusiness(MarKITException e) {
        return ResponseEntity.status(e.getStatus())
            .body(new ApiErrorResponse(e.getErrorCode(), e.getMessage(), ...));
    }
    
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnknown(...) {
        log.error("Unhandled", e);
        return 500; // 사용자에겐 generic 메시지, 로그엔 상세
    }
}
```

## 설정 파일 (application.yml)

```yaml
spring:
  application.name: makit
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/makit}
    username: ${SPRING_DATASOURCE_USERNAME:makit_user}
    password: ${SPRING_DATASOURCE_PASSWORD:}
  jpa:
    hibernate.ddl-auto: validate
    properties.hibernate.jdbc.time_zone: UTC
  flyway.enabled: true
  data.redis:
    host: ${SPRING_REDIS_HOST:localhost}
    port: 6379

jwt:
  secret: ${JWT_SECRET:}
  access-token-ttl: PT1H
  refresh-token-ttl: P7D

aws:
  region: ${AWS_REGION:ap-northeast-2}
  bedrock:
    text-model-id: anthropic.claude-3-haiku-20240307-v1:0
    image-model-id: stability.stable-diffusion-xl-v1
  s3:
    bucket: ${S3_BUCKET:makit-assets}

management:
  endpoints.web.exposure.include: health,info,metrics,prometheus
  endpoint.health.show-details: when_authorized

springdoc:
  swagger-ui.path: /swagger-ui.html
  api-docs.path: /v3/api-docs
```

## Flyway 마이그레이션 규칙

- 파일명: `V{YYYYMMDDHHMM}__{snake_case}.sql` (예: `V202604010900__create_users.sql`)
- **이미 배포된 버전은 절대 수정 금지**. 수정이 필요하면 새 버전 파일 추가.
- 모든 테이블에 `created_at`, `updated_at`, `version`(`@Version` 낙관락) 컬럼

## 테스트 전략

| 레이어 | 어노테이션 | 용도 |
|-------|-----------|------|
| Repository | `@DataJpaTest` | Flyway + 실제 쿼리 (Testcontainers Postgres) |
| Service | `@ExtendWith(MockitoExtension.class)` | 비즈니스 로직 단위 |
| Controller | `@WebMvcTest` | MockMvc + Security mock |
| 통합 | `@SpringBootTest(webEnvironment=RANDOM_PORT)` | RestAssured + Testcontainers |

## 비동기 작업 규약

- 긴 AI 호출은 `CompletableFuture<T>` 반환 + `@Async("aiExecutor")`
- Executor는 Java 21 virtual threads:
  ```java
  @Bean("aiExecutor")
  public Executor aiExecutor() {
      return Executors.newThreadPerTaskExecutor(Thread.ofVirtual().factory());
  }
  ```
- 결과 조회는 jobId 기반 polling: `GET /api/{domain}/jobs/{jobId}`

## 금지 사항

- `Lombok @Data` on Entity (equals/hashCode 폭탄). `@Getter/@Setter`만.
- Entity를 Controller 응답으로 직접 반환
- `hibernate.ddl-auto: update` in prod — 반드시 `validate`
- `System.out.println` — SLF4J `log`만
- `@Autowired` 필드 주입 — 생성자 주입만

## 참고 문서

- [Spring Boot 3.2 Reference](https://docs.spring.io/spring-boot/docs/3.2.0/reference/html/)
- [Spring Security 6 JWT Guide](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
- 프로젝트 `README.md`의 "설계 문서" 섹션 (Entity/DTO 참조 모델 포함)
