# 사용자 인증 & 관리

> 한 줄 설명: JWT 기반 인증 + RefreshToken + RateLimit + DemoUserSeeder로 완벽한 인증 시스템 구현

## 목적

모든 MaKIT 사용자의 로그인, 가입, 프로필 관리, 비밀번호 변경을 안전하게 처리하며, 데모 환경에서는 즉시 사용 가능한 테스트 계정을 제공.

## 사용자 시나리오

1. 미로그인 사용자가 /login.html 접근
2. "로그인" 또는 "회원가입" 선택
3. 이메일 + 비밀번호 입력 및 검증
4. 백엔드에서 JWT AccessToken + RefreshToken 쿠키 발급
5. 인증 상태 유지로 protected 페이지 접근
6. 토큰 만료 시 자동 갱신 (RefreshToken)
7. 로그아웃 → 토큰 삭제 → login.html 리디렉트

## 기술 스택

### 백엔드
- **도메인**: `backend/src/main/java/com/humanad/makit/auth`
- **주요 클래스**:
  - `AuthController` (POST /api/auth/login, /register, /me, /logout, /refresh)
  - `AuthService`/`AuthServiceImpl` (JWT 발급, 비밀번호 검증)
  - `JwtTokenProvider` (JWT 서명/검증)
  - `JwtAuthenticationFilter` (요청 인터셉팅)
  - `DemoUserSeeder` (dev/local 환경에서만 demo 계정 초기화)
  - `RateLimitFilter` (brute-force 방지, 100 req/min)
- **데이터**: User entity, UserRepository
- **외부 API**: (없음 — 내부 구현)

### 프론트엔드
- **페이지**: `frontend/login.html`
- **API 클라이언트**: `frontend/js/api.js::auth.{login,register,updateProfile,changePassword,logout}`
- **컴포넌트**: `frontend/js/pages/login.js`, `frontend/js/auth.js` (JWT 저장/갱신)
- **스타일**: `frontend/css/app-shell.css` (D1 토큰)

### 테스트
- **E2E**: `tests/e2e/auth.spec.ts` (6개 시나리오: login, register, invalid-creds, rate-limit, logout, token-refresh)

## API 계약

### REST 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/login | 로그인 | - |
| POST | /api/auth/register | 회원가입 | - |
| GET | /api/auth/me | 현재 사용자 정보 | required |
| PATCH | /api/auth/me | 프로필 업데이트 | required |
| POST | /api/auth/change-password | 비밀번호 변경 | required |
| POST | /api/auth/logout | 로그아웃 | required |
| POST | /api/auth/refresh | 토큰 갱신 | - (RefreshToken 쿠키) |

자세한 내용은 [api.md](./api.md) 참고.

## 의존성

### 내부 의존성
- audit (로그인/로그아웃 기록)
- dashboard (사용자 통계)

### 외부 의존성
- Spring Security (RBAC)
- JWT (io.jsonwebtoken)
- PostgreSQL (사용자 저장소)
- bcrypt (비밀번호 해싱)

## 설정

### 환경 변수
```env
JWT_SECRET=your-256-bit-secret-key
JWT_EXPIRATION_MS=3600000
JWT_REFRESH_EXPIRATION_MS=604800000
DEMO_USER_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
```

### 마이그레이션
- `V{N}__create_users.sql` — users 테이블 + 인덱스

## 모니터링 & 로깅

- **메트릭**: 로그인 시도/성공률, 회원가입 수, 토큰 갱신 횟수
- **로그 레벨**: INFO (로그인/로그아웃), WARN (비밀번호 오류 3회+), ERROR (DB 오류)
- **알림**: 실패한 로그인 시도 > 10회/5분 (CloudWatch)

## 변경 이력

최신 R 라운드별 이력은 [changelog.md](./changelog.md) 참고.

### 주요 마일스톤
- R1 (2026-04-20): JWT + RefreshToken 초기 구현
- R5 (2026-04-25): 프로필 편집 + 비밀번호 변경 엔드포인트 추가
- R16b (2026-04-26): 관리자 역할 추가 (ROLE_ADMIN)

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 보안: `docs/architecture/01_architect_security_model.md`
- 라운드 산출물: `docs/rounds/`
