# R15d: E2E Test Scenarios & Playwright Implementation

**문서 작성일:** 2026-04-26  
**대상:** MaKIT 플랫폼 (v1.0 + R14c Web Push)  
**작성자:** QA Engineer (Team)

---

## 1. 개요

MaKIT 플랫폼의 핵심 사용자 여정(User Journey)을 E2E 테스트로 검증하는 종합 시나리오 문서입니다. 
Playwright를 활용하여 Chrome 및 Mobile Chrome 환경에서 해피 패스(Happy Path)·에러 케이스·경계 조건을 테스트합니다.

---

## 2. 사전 요구사항

### 2.1 테스트 환경
- **Node.js:** 18.x 이상
- **npm/yarn:** 최신 버전
- **Browser:** Chromium (Playwright로 자동 관리)
- **Backend:** localhost:8080 또는 `MAKIT_BASE_URL` env 변수로 지정
- **Database:** PostgreSQL 14+ (Spring Boot 연동)
- **AWS:** Bedrock API keys (선택, stub-mode 가능)

### 2.2 데모 사용자 계정
```
이메일:    demo@makit.local
비밀번호:  Demo!1234
이름:      Demo User
역할:      마케터
```
계정은 `DemoUserSeeder` (backend/src/main/java/.../seed/)에서 초기화됨.

### 2.3 필수 시스템 설정
- **Web Push (VAPID):** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env vars  
  (없으면 UI는 숨겨지지만 에러 없음 — graceful disable)
- **Bedrock:** `AWS_BEDROCK_REGION` (기본값: us-west-2)  
  (없으면 stub markdown으로 fallback)

---

## 3. 핵심 사용자 여정 (6개)

### 3.1 J1: 회원가입 및 자동 로그인
**시나리오 이름:** 신규 사용자 온보딩

**전제 조건:**
- intro.html 페이지에 접근 가능
- 네트워크 정상
- Backend 회원가입 endpoint 정상

**단계별 액션:**
1. `intro.html` 로드 → Hero section + CTA "플랫폼 보기" 버튼 노출 확인
2. 예상: Hero 제목 "MaKIT으로 비즈니스 성장을 가속화하세요" 표시
3. "플랫폼 보기" 버튼 클릭 → login.html 리다이렉트
4. 예상: Login 페이지 로드, "로그인" 탭 활성화
5. "회원가입" 탭 클릭 → Register form 표시
6. 예상: 4개 입력 필드 표시 (이름, 이메일, 비밀번호, 비밀번호 확인)
7. 폼 채우기:
   - 이름: "E2E Test User {timestamp}"
   - 이메일: "e2e+{timestamp}@makit-test.local"
   - 비밀번호: "E2eTest!1234"
   - 비밀번호 확인: "E2eTest!1234"
8. 예상: 비밀번호 강도 표시 "강함" 또는 "매우 강함" (색상 초록색)
9. "이용약관" 동의 체크박스 클릭
10. "회원가입" 버튼 클릭 → spinner 표시, 요청 전송
11. 예상: 1~3초 후 `index.html`로 자동 리다이렉트
12. 예상: 대시보드 로드, Hero section "Welcome To MaKIT Platform!" 표시

**예상 결과:**
- Register 201 Created, JWT token 생성
- Frontend에서 자동 login 호출 (token 설정)
- Dashboard 모든 카드 렌더링 완료
- User menu에 신규 사용자 이름 표시

**실패 모드:**
- 이메일 중복 → 409 Conflict, "이메일이 이미 등록되었습니다" 에러 메시지 표시
- 비밀번호 불일치 → Frontend validation, "비밀번호가 일치하지 않습니다" 표시
- 네트워크 타임아웃 → 5초 후 타임아웃, 재시도 가능
- Backend 500 → "오류가 발생했습니다" + 재시도 UI

**예상 실행 시간:** 8~12초

---

### 3.2 J2: 서비스 실행 및 히스토리 추적
**시나리오 이름:** 자연어 분석 서비스 사용 → 결과 확인

**전제 조건:**
- 사용자 로그인 완료 (J1 또는 demo 계정)
- index.html 대시보드 로드 완료

**단계별 액션:**
1. 대시보드에서 "핵심 서비스" 섹션 확인
2. 예상: 3개 서비스 카드 (AX Data, AX Marketing, AX Commerce)
3. "AX Data Intelligence" 카드에서 "서비스 사용" 버튼 클릭
4. 예상: `service-detail.html?service=nlp-analyze` 로드
5. 페이지 제목 확인: "자연어 분석 | MaKIT"
6. Welcome 텍스트: "텍스트를 분석하고 인사이트를 얻으세요"
7. 자유 입력 폼 표시: textarea + "분석" 버튼
8. 텍스트 입력: "MaKIT은 AI 마케팅 플랫폼입니다. 매우 강력합니다."
9. "분석" 버튼 (또는 Shift+Enter) 클릭
10. 예상: 스트리밍 시작, 마크다운 형식의 답변 실시간 렌더링
11. 답변 완료 후 thumbs-up/thumbs-down 피드백 버튼 표시
12. Thumbs-up 클릭
13. 예상: "피드백 감사합니다" 토스트 메시지
14. history.html로 네비게이션
15. 예상: 활동 목록에 "자연어 분석" 항목 표시, 타임스탬프 포함

**예상 결과:**
- Service call 201 Created, audit_logs에 INSERT
- Bedrock Claude Haiku 스트리밍 성공
- Markdown 렌더링 (bold, code, lists 등)
- Chatbot feedback 201 Created
- History 페이지에 "서비스 호출" 항목 및 "자연어 분석" 리소스 표시

**실패 모드:**
- Bedrock 타임아웃 → stub markdown으로 fallback (source: "stub-rule-based")
- 네트워크 끊김 → "연결 실패" 에러, 재시도 버튼
- 빈 입력 → Frontend validation, "분석할 텍스트를 입력해주세요" 표시
- Backend 500 → 에러 메시지, 콘솔 error log 확인

**예상 실행 시간:** 12~25초 (Bedrock 지연 포함)

---

### 3.3 J3: 마케팅 허브 캠페인 관리
**시나리오 이름:** 캠페인 생성 → 상태 변경 → 알림 확인

**전제 조건:**
- 사용자 로그인 완료
- 대시보드 접근 가능

**단계별 액션:**
1. 왼쪽 사이드바에서 "마케팅 허브" 클릭
2. 예상: `marketing-hub.html` 로드
3. 요약 카드 4개 확인 (캠페인, 콘텐츠, 실행중, 완료)
4. "신규 캠페인" 또는 "+ 추가" 버튼 클릭
5. 예상: 모달 open, form 표시 (이름, 채널, 시작일, 상태)
6. 폼 채우기:
   - 캠페인 이름: "E2E Test Campaign"
   - 채널: "INSTAGRAM" (드롭다운)
   - 시작일: 내일 날짜
   - 상태: "DRAFT" (기본값)
7. "생성" 버튼 클릭
8. 예상: 201 Created, 모달 close, 칸반 보드 갱신
9. 예상: 우상단 알림 종 badge "1" 표시
10. 알림 종 클릭 → 패널 open
11. 예상: "캠페인이 생성되었습니다. E2E Test Campaign (INSTAGRAM)" 알림 표시
12. 알림 클릭 → 캠페인 상세 페이지로 네비게이션 (또는 모달 open)
13. 캠페인 상태 버튼 클릭: DRAFT → SCHEDULED
14. 예상: 요청 전송, 칸반 보드에서 카드 이동
15. 예상: 알림 종 badge "2" (새 상태변경 알림)
16. 알림 패널에서 "예약됨" 알림 확인

**예상 결과:**
- Campaign 201 Created, marketing-campaign 리소스 audit_logs INSERT
- Notification 201 Created (캠페인 생성)
- Status change 202 Accepted, state machine validation 통과
- Notification 201 Created (상태 변경)
- WebSocket STOMP push로 실시간 알림 badge 갱신
- History 페이지에서 2개 항목 (CAMPAIGN_CREATE, CAMPAIGN_STATUS_CHANGE) 확인 가능

**실패 모드:**
- 필수 필드 누락 → Frontend validation 에러
- 잘못된 상태 전환 (ARCHIVED → ACTIVE) → 400 Bad Request, "유효하지 않은 상태 전환입니다"
- WebSocket disconnect → notification 여전히 DB+polling으로 수신
- Notification service down → API는 성공, notification DB INSERT만 실패 (graceful fallback)

**예상 실행 시간:** 15~20초

---

### 3.4 J4: 알림 시스템 (종 + 패널 + 클릭)
**시나리오 이름:** 알림 수신 → 패널 오픈 → 액션 수행

**전제 조건:**
- 사용자 로그인 완료
- 임의의 페이지 (index/marketing-hub/all-services 등)

**단계별 액션:**
1. 우상단 알림 종 아이콘 확인 (현재 badge 표시 없음)
2. 예상: Badge 클래스 hidden 또는 display:none
3. 서비스 호출 또는 캠페인 생성 (J2/J3 참고)
4. 예상: 1초 내 알림 종 badge "1" 표시 (WebSocket push)
5. 알림 종 클릭
6. 예상: 우상단에 360px 패널 slide-up
7. 패널 콘텐츠:
   - 헤더: "알림"
   - 닫기 버튼 (X)
   - 알림 목록 (최대 20개, 최신순)
   - 각 알림: 아이콘(색상) + 메시지 + 상대시간 + 읽음 상태
8. 알림 hover → 약간의 highlight 배경
9. 알림 클릭 → 리소스 페이지로 네비게이션 (또는 모달)
10. 예상: 모달이 닫히고 리소스 상세 페이지 로드
11. 패널 다시 열기 → 클릭한 알림이 읽음 상태로 갱신
12. "전체 읽음" 버튼 클릭
13. 예상: 모든 알림 읽음 처리, badge 사라짐

**예상 결과:**
- Notification read status 204 No Content
- Badge 실시간 갱신 (WebSocket)
- 패널 smooth slide-up animation
- 읽음/미읽음 색상 구분 (진함/연함)
- History 페이지에서 활동 확인 가능

**실패 모드:**
- WebSocket 끊김 → polling fallback (5초 간격)
- Notification service down → UI는 작동, 패널은 비어있음
- 네트워크 지연 → 배지 갱신 지연 (최대 10초)

**예상 실행 시간:** 8~12초

---

### 3.5 J5: 설정 페이지 (테마·접근성·푸시)
**시나리오 이름:** 프로필 편집 → 다크모드 전환 → 푸시 활성화

**전제 조건:**
- 사용자 로그인 완료
- 우상단 user menu 접근 가능

**단계별 액션:**
1. 우상단 사용자 아바타 (initials) 클릭
2. 예상: 드롭다운 메뉴 open
   - 이름 + 역할 뱃지
   - "설정" 링크
   - "활동 이력" 링크
   - "로그아웃" 버튼
3. "설정" 클릭 → `settings.html` 로드
4. 예상: 4개 섹션 (프로필, 비밀번호 변경, 화면 테마, 푸시 알림)
5. **프로필 섹션:**
   - 이름 입력: "Updated User Name"
   - 이메일: 변경 불가 (읽기 전용) 또는 변경 가능
   - "저장" 버튼 클릭
   - 예상: 200 OK, "저장되었습니다" 토스트
6. **비밀번호 변경 섹션:**
   - 현재 비밀번호: "Demo!1234"
   - 새 비밀번호: "NewPass!5678"
   - 새 비밀번호 확인: "NewPass!5678"
   - "비밀번호 변경" 버튼 클릭
   - 예상: 200 OK, "비밀번호가 변경되었습니다"
7. **화면 테마 섹션:**
   - "라이트" 버튼 클릭 (현재 상태 확인)
   - 예상: active 상태 border 파란색, 배경 연파란색
   - "다크" 버튼 클릭
   - 예상: 즉시 전체 페이지 다크 모드 전환 (DOM data-theme="dark")
   - 배경색: #1a1a1a, 텍스트색: #e6e6e6
   - localStorage makit_theme 저장
8. **모션 설정:**
   - "애니메이션 줄이기" 체크박스 체크
   - 예상: CSS prefers-reduced-motion override 적용
   - 다른 페이지로 이동했다가 돌아오기
   - 예상: 체크 상태 유지 (localStorage 영속)
9. **푸시 알림 섹션 (조건부, Web Push 지원 시):**
   - "활성화" 버튼 클릭
   - 예상: Browser push permission dialog
   - "허용" 클릭 (또는 차단)
   - 예상: subscription 생성, POST /api/push/subscribe 호출
   - 예상: "푸시 알림이 활성화되었습니다" 메시지
   - "테스트 알림 전송" 버튼 노출
   - 버튼 클릭 → 테스트 푸시 알림 수신
   - 예상: OS-level notification (탭/브라우저 닫혀있어도 수신)
10. 페이지 새로고침 → 모든 설정 유지 확인

**예상 결과:**
- Profile update 200 OK, user JWT 갱신
- Password change 200 OK, 새 password로 로그인 가능
- Theme 실시간 적용, 모든 페이지에서 일관적
- Reduce motion 전역 CSS override
- Web Push subscription 201 Created
- VAPID handshake 완료
- 푸시 테스트 알림 OS-level notification 표시

**실패 모드:**
- 비밀번호 불일치 → 409 Conflict, "현재 비밀번호가 틀렸습니다"
- 이메일 중복 → 409 Conflict
- Browser push 차단 → UI graceful, "푸시 알림을 지원하지 않습니다"
- VAPID keys 미정 → push card hidden
- Service worker 미등록 → push 불가 (404 sw.js)

**예상 실행 시간:** 10~15초

---

### 3.6 J6: PWA 설치 및 오프라인 동작
**시나리오 이름:** PWA 설치 → Standalone 모드 → 오프라인 캐시

**전제 조건:**
- Chrome/Chromium 90+
- HTTPS 또는 localhost
- manifest.webmanifest 유효
- service worker registered

**단계별 액션:**
1. `intro.html` 또는 `index.html` 방문
2. 예상: 브라우저 주소창 옆에 "앱 설치" 또는 "Download" 버튼
   - 또는 페이지의 custom "앱 설치" 버튼 (frontend/sw-register.js에서 beforeinstallprompt capture)
3. "앱 설치" 버튼 클릭
4. 예상: Browser native install dialog (또는 custom modal)
   - MaKIT 아이콘 (192x192)
   - "MaKIT - AI 마케팅 플랫폼"
   - "설치" 버튼
5. "설치" 클릭
6. 예상: 앱이 OS launcher/홈화면에 추가됨
7. 앱 실행
8. 예상: Standalone 모드 (chrome://apps, or desktop shortcut)
   - 주소창 숨겨짐
   - PWA 제목 표시
   - 전체 화면 활용
9. 네트워크 끔 (개발자 도구 > Network > Offline)
10. 앱의 다른 페이지 네비게이션 (index.html → all-services.html)
11. 예상: Service worker cache에서 shell asset (HTML, CSS, JS) 로드됨
12. 페이지 렌더링 성공 (skeleton screen 표시)
13. 서비스 호출 시도 (또는 API 호출)
14. 예상: "오프라인입니다" 메시지 (또는 graceful fallback)
15. 네트워크 켜기 → 자동 재연결
16. 앱 닫았다가 다시 열기
17. 예상: 캐시된 shell로 빠른 로드 (LCP < 1초)

**예상 결과:**
- Manifest valid, icon 다운로드
- Service worker precache 25+ 파일
- Install prompt 성공
- Standalone mode theme color #2563eb
- Offline navigation stale-while-revalidate
- Online으로 돌아올 때 API sync
- Repeat visits 30초 내 update check

**실패 모드:**
- HTTPS 아님 + localhost 아님 → install 불가
- manifest.webmanifest 404 → install 불가
- Service worker 에러 → console error, cache 미작동
- 권한 거절 → graceful, "install 권한 필요"

**예상 실행 시간:** 20~30초 (installation + offline test)

---

## 4. 경계 테스트 (5개)

### B1: WebSocket 재연결 및 resilience
**테스트:** Network drop → 자동 재연결 → 알림 push 수신

**단계:**
1. 로그인 완료 상태
2. 개발자 도구 > Network > Throttle: "Offline"
3. 예상: WebSocket disconnect, reconnect 시도 (exponential backoff)
4. 서비스 호출 (또는 다른 사용자가 notification trigger)
5. 예상: 오프라인 상태이므로 알림 badge 미갱신
6. Throttle 복구 (Online)
7. 예상: 10초 내 재연결 (STOMP SUBSCRIBE)
8. 예상: pending 알림들 폴링 또는 재전송으로 catch-up
9. 확인: 알림 badge 갱신, 패널에서 모든 알림 표시

**성공 조건:** Disconnect/reconnect cycle 2회 시 모든 알림 누락 없음

---

### B2: Service Worker 설치 및 캐시 precache
**테스트:** 첫 방문 → sw.js 설치 → 25개+ asset precache → repeat visit cache-first

**단계:**
1. Private/Incognito 모드로 신규 방문
2. DevTools > Application > Service Workers → 없음 확인
3. index.html 로드
4. 예상: sw-register.js 실행, install event 트리거
5. 예상: 60초 내 update check (backgroundSync)
6. DevTools > Application > Service Workers → "MaKIT sw" active 확인
7. Cache Storage 확인: "makit-shell-v1" cache에 25+ 파일
8. DevTools > Network > Disable cache 해제 (cache enabled)
9. 페이지 새로고침
10. 예상: Network에서 HTML/JS/CSS "from ServiceWorker" 표시
11. 로딩 시간 < 500ms (cache hit)
12. 파일 수정 후 배포 (또는 sw.js 버전 갱신)
13. 예상: 사용자 페이지 방문 시 update 감지 (60초 체크)
14. 예상: "업데이트 가능" 알림 또는 자동 reload

**성공 조건:** Repeat visit with cache < 500ms, update detection within 2min

---

### B3: Rate Limit 429 처리
**테스트:** API 요청 폭주 → 429 Too Many Requests → Retry-After

**단계:**
1. 로그인 완료
2. 빠른 연속 요청 20개 (예: chatbot 호출 x 20)
   ```
   for i in {1..20}; do
     curl -X POST http://localhost:8080/api/data-intelligence/nlp-analyze \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"text":"test"}' &
   done
   ```
3. 예상: 요청 10개 허용, 11번째부터 429 + Retry-After: 60
4. UI 응답:
   - 성공한 요청들은 처리
   - 429 요청들은 "요청이 너무 많습니다. 60초 후 재시도해주세요" 메시지
   - 자동 재시도 UI 또는 수동 "재시도" 버튼
5. 60초 후 자동 재시도 (또는 사용자 클릭)
6. 예상: 성공 (200 OK)

**성공 조건:** 429 감지 → Retry-After 준수 → 재시도 성공

---

### B4: Bedrock 장애 → Fallback to Stub
**테스트:** Bedrock timeout/error → stub markdown 자동 사용

**단계:**
1. Bedrock 비활성화 또는 timeout 설정 (또는 invalid credentials)
2. 로그인 후 서비스 호출 (자연어 분석)
3. 예상: API 요청 전송, Bedrock 장애 감지
4. 예상: 5초 타임아웃 후 fallback to stub
5. 예상: 사용자에게 stub markdown 반환 (source: "stub-rule-based")
6. UI에서 "이 응답은 예시입니다" 또는 "실제 분석 기능 점검 중입니다" 배너 표시
7. 콘솔 log: [WARN] Bedrock exception, falling back to rule-based

**성공 조건:** Fallback seamless, no 500 error, stub markdown rendered

---

### B5: PostgreSQL down → Graceful Degradation
**테스트:** Database connection failure → service down page 표시

**단계:**
1. PostgreSQL stop
2. 로그인 시도 (또는 이미 로그인 상태)
3. 임의의 API 호출 (dashboard/stats)
4. 예상: 503 Service Unavailable 또는 500 Internal Server Error
5. 예상: UI에 "서비스 점검 중입니다. 잠시 후 다시 시도해주세요" 페이지
6. 또는 현재 페이지 유지하되 관련 API는 error state로 skeleton 표시
7. 콘솔: [ERROR] Database connection failed

**성공 조건:** Error handling graceful, no blank page, user-friendly message

---

## 5. 성능 벤치마크 (타겟값)

| 지표 | 목표 | 측정 페이지 | 설명 |
|------|------|-----------|------|
| **LCP** | < 2.5s | intro.html | Largest Contentful Paint (hero SVG) |
| **FCP** | < 1.5s | index.html | First Contentful Paint (skeleton) |
| **CLS** | < 0.1 | all pages | Cumulative Layout Shift (stable layout) |
| **TTI** | < 4s | dashboard | Time to Interactive (사용자 입력 가능) |
| **Skeleton visibility** | 100ms | navigation | Skeleton screen 즉시 표시 |
| **Cache hit** | < 500ms | repeat visit | Service worker cache (after install) |
| **API response** | < 2s | chatbot | Backend API (3G fast throttle) |

**측정 도구:**
- Playwright performance API
- Chrome DevTools Network tab
- Lighthouse (programmatic)

---

## 6. 테스트 데이터 초기화

### 6.1 Backend Demo Data
```bash
# DemoUserSeeder.java에서 자동 생성 (app startup 시)
- demo@makit.local / Demo!1234
- 3개 stub campaign
- 5개 stub content
- 30개 audit_logs (seed data)
```

### 6.2 E2E 테스트용 신규 사용자
```javascript
// Playwright fixture에서 동적 생성
const ts = Date.now();
const testUser = {
  name: `E2E Test ${ts}`,
  email: `e2e+${ts}@makit-test.local`,
  password: `E2eTest!${ts % 10000}`  // 강력한 비밀번호
};
```

### 6.3 Database Reset (선택)
```sql
-- test 전 실행 (sandbox mode)
DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e+%@makit-test.local');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e+%@makit-test.local');
DELETE FROM campaigns WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e+%@makit-test.local');
DELETE FROM users WHERE email LIKE 'e2e+%@makit-test.local';
```

---

## 7. 알려진 제한사항

1. **Bedrock 비활성화:** VAPID keys 미정 → push 카드 숨겨짐 (정상)
2. **Service Worker:** localhost/HTTPS 전용, Incognito 모드에서 제한됨
3. **Web Push:** Browser push permission required (grant/deny 사용자 선택)
4. **Rate Limit:** Per-user per-minute throttle 가능 (현재 10/min), env로 설정 가능
5. **Offline:** Network-first API는 offline 실패, shell assets만 cache (정상)
6. **Multi-tab:** 한 탭의 login/logout이 다른 탭에 반영되지 않을 수 있음 (세션 동기화 미지원)

---

## 8. 참고 자료

- **Playwright 공식 문서:** https://playwright.dev
- **MaKIT Backend API Docs:** `/api/swagger-ui.html` (localhost:8080)
- **Frontend 빌드:** `cd frontend && npm install && npm run build` (선택, 현재 static)
- **CI/CD:** GitHub Actions (`.github/workflows/e2e.yml` 추가 예정)

---

**문서 버전:** 1.0  
**마지막 업데이트:** 2026-04-26
