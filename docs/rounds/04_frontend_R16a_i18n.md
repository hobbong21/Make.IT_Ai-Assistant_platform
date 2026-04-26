# R16a: Internationalization (i18n) 인프라 구축

**날짜**: 2026-04-26  
**대상**: MaKIT Frontend  
**상태**: 완료 (R16a)

---

## 개요

MaKIT 플랫폼을 전역 시장에 대비하기 위해 다국어 지원(i18n) 기반 인프라를 구축했습니다. 한국어(ko), 영어(en), 일본어(ja) 3언어를 초기 지원하며, 사용자가 설정 페이지 또는 글로벌 언어 선택기에서 언어를 전환할 수 있습니다.

---

## 산출물

### 1. **frontend/js/i18n-dict.js** (~300줄)
- **목적**: 3언어 사전(dictionary) 정의
- **구조**: `window.makitI18nDict = { ko: {...}, en: {...}, ja: {...} }`
- **커버리지**: ~80개 UI 텍스트 키
  - 네비게이션 (nav.home, nav.services, nav.marketing-hub 등)
  - 인증 (auth.login, auth.register, auth.password 등)
  - 대시보드 (dashboard.welcome, dashboard.stat-users 등)
  - 서비스 (services.title, services.use, services.categories.* 등)
  - 마케팅 허브 (hub.campaigns, hub.contents, hub.calendar 등)
  - 설정 (settings.profile, settings.language, settings.theme 등)
  - 알림 (notif.title, notif.empty, notif.read-all 등)
  - 공통 (common.loading, common.error, common.save 등)

**언어별 특성**:
- **한국어 (ko)**: 기존 UI 텍스트 그대로 보존 (rephrase 안 함)
- **영어 (en)**: 자연스러운 마케팅 영어 (기계번역 아님)
- **일본어 (ja)**: 일본 마케팅 용어 활용 (예: "マーケティングハブ" for marketing hub)

---

### 2. **frontend/js/i18n.js** (~200줄)
- **목적**: i18n 핵심 엔진 (번역 함수, 로케일 관리, DOM 업데이트)
- **주요 함수**:
  - `t(key, params)`: 키로 번역 조회 (`t('nav.home')` → '홈')
    - 플레이스홀더 지원: `t('message', {name: 'John'})` → 'Hello {name}' → 'Hello John'
    - Fallback 체인: 현재 언어 → 한국어 → 영어 → 키 자체
  - `setLocale(locale)`: 언어 설정 (localStorage 저장 + HTML lang 속성 동기화)
  - `getLocale()`: 현재 언어 조회
  - `i18nApply()`: 모든 `[data-i18n]` 요소 번역 적용 (초기화 + 재계산)

- **DOM 속성 지원**:
  - `data-i18n="key"`: textContent 번역
  - `data-i18n-attr="attr1:key1,attr2:key2"`: 속성값 번역 (예: `title`, `placeholder`)
  - `data-i18n-html="key"`: innerHTML 번역 (마크다운 포함 가능)

- **라이프사이클**:
  - DOMContentLoaded 시 자동 `i18nApply()` 호출
  - 언어 전환 시 `setLocale()` → 모든 요소 재번역 + `makit:localechange` 커스텀 이벤트

---

### 3. **frontend/js/app-shell-extras.js** (언어 선택기 추가)
- **추가**: `buildLanguagePicker()` + `bindLanguagePicker()` 함수 (~100줄)
- **위치**: 우상단 fixed, 다크모드 토글(theme) 근처
- **UI**:
  - 글로브 아이콘 + 현재 언어명 (ko: '한국어', en: 'English', ja: '日本語')
  - 드롭다운: 3개 언어 버튼 (현재 선택 활성화 표시)
  - 반응형: 모바일에서 언어명 숨김 (아이콘만 표시, ~40px)
- **동작**:
  - 클릭 시 드롭다운 토글
  - 언어 선택 → `window.makitI18n.setLocale(code)` 호출 → 페이지 재번역 + 드롭다운 닫기
  - ESC/외부 클릭으로 닫기

---

### 4. **frontend/css/app-shell.css** (언어 선택기 스타일, ~120줄)
- **클래스 계층**:
  - `.mk-lang-picker`: 컨테이너 (fixed position)
  - `.mk-lang-toggle`: 버튼 (D1 토큰 사용)
  - `.mk-lang-dropdown`: 드롭다운 메뉴 (애니메이션 전환)
  - `.mk-lang-option`: 각 언어 옵션

- **스타일링**:
  - D1 토큰 전면 사용 (색, 반지름, 그림자, 모션)
  - 다크모드 페어 (@media prefers-color-scheme: dark)
  - 모바일 반응형 (768px 이하에서 레이아웃 조정)
  - hover/focus-visible 상태 (접근성)
  - 활성 언어 시각화 (배경색 + 진한 글자색)

---

### 5. **frontend/index.html** (샘플 마이그레이션)
- **i18n 스크립트 포함 순서**:
  ```html
  <script src="js/i18n-dict.js"></script>  <!-- 먼저 로드 -->
  <script src="js/i18n.js"></script>        <!-- 그 다음 -->
  <script src="js/app-shell-extras.js"></script>  <!-- 최후 -->
  ```

- **데이터 속성 추가** (5개 요소):
  - `<h1 data-i18n="dashboard.welcome">`: 히어로 제목
  - `<p data-i18n="dashboard.subtitle">`: 히어로 자막
  - `<h2 data-i18n="services.title">`: '핵심 서비스' 섹션 제목
  - `<a data-i18n="services.use">`: 3개 서비스 카드의 '서비스 사용' 버튼

---

## 검증

### 문법 확인
- ✅ i18n.js: IIFE + window.makitI18n 구조 valid
- ✅ i18n-dict.js: ES6 object literal valid (ko/en/ja 사전 모두 ~80 key-value 쌍)
- ✅ app-shell-extras.js: 기존 코드 무손상 + 언어 선택기 append at DOMContentLoaded
- ✅ app-shell.css: 모든 토큰 참조 유효 (--mk-color-*, --mk-space-*, --mk-radius-* 등)

### 통합 확인
- ✅ index.html `<head>` 스크립트 로드 순서: dict → i18n → app-shell-extras
- ✅ data-i18n 속성 5개 추가 (hero title/subtitle, services title, 3 buttons)
- ✅ 언어 선택기 UI: 우상단 fixed, 다크모드 지원, 모바일 반응형

### 기능 동작 예상
1. **페이지 로드**:
   - i18n-dict.js: 사전 로드
   - i18n.js: 초기화, localStorage에서 언어 복구, DOMContentLoaded → `i18nApply()`
   - index.html의 5개 data-i18n 요소 → 한국어 텍스트로 번역 (기본값)

2. **언어 전환**:
   - 사용자 우상단 언어 선택기 클릭
   - 영어(en) 선택 → `setLocale('en')` 호출
   - 모든 data-i18n 요소 재번역 (hero, services 섹션 영문 표시)
   - 언어 선택기 버튼 레이블 업데이트: '한국어' → 'English'
   - localStorage `makit_locale=en` 저장 → 새로고침해도 영어 유지

3. **Fallback**:
   - 미번역 키 (예: 'unknown.key')는 키 자체 표시
   - 구형 브라우저/런타임 에러 → 콘솔 warn, UI 여전히 작동

---

## 다음 라운드 (R17+) 로드맵

### 우선순위
1. **R17a — 전체 HTML 마이그레이션** (1시간)
   - intro.html, login.html, all-services.html, service-detail.html, marketing-hub.html, history.html, settings.html, 404.html
   - 각 페이지의 주요 UI 텍스트 (~15-20개 per page) data-i18n 속성 추가
   - 네비게이션, 섹션 제목, 버튼, 라벨, 플레이스홀더

2. **R17b — 백엔드 에러 메시지 i18n** (45분)
   - 401/409/429 에러 메시지 (현재 고정값)를 백엔드에서 `error.auth.401` 같은 키로 전송
   - frontend api 에러 핸들러가 키를 수신 → `window.makitI18n.t()` 호출
   - audit_logs, notifications 등 동적 메시지도 마찬가지

3. **R17c — settings.html 언어 선택기 공식화** (20분)
   - settings.html에 "언어" 섹션 추가 (사용자가 프로필 페이지에서도 설정 가능)
   - 라디오/드롭다운 형태 (글로벌 선택기와 동기화)

4. **R17d — SEO 다국어 메타** (30분)
   - 각 HTML `<head>`에 `<link rel="alternate" hreflang="en" href="...">` 추가
   - Open Graph og:locale, og:locale:alternate 추가
   - XML sitemap 다국어 대응 (backend)

---

## 사용 가이드 (개발자)

### 새로운 번역 키 추가
1. i18n-dict.js의 `ko` 섹션에 키-값 추가:
   ```js
   'settings.notifications': '알림 설정',
   ```
2. 동일한 키를 `en`, `ja` 섹션에도 추가

### HTML에 번역 적용
- **텍스트**: `<h1 data-i18n="nav.home">홈</h1>`
- **속성** (placeholder 등): `<input data-i18n-attr="placeholder:auth.email" />`
- **HTML** (마크다운 포함): `<div data-i18n-html="common.help">...</div>`

### JavaScript에서 번역 조회
```js
const message = window.makitI18n.t('nav.home'); // '홈' (ko) or 'Home' (en)
const welcome = window.makitI18n.t('common.welcome', {name: 'Alice'});
```

### 언어 변경 감지
```js
document.addEventListener('makit:localechange', (e) => {
  console.log('New locale:', e.detail.locale); // 'en', 'ja', etc.
  // 필요시 재렌더링 (예: Chart.js 라벨 다시 그리기)
});
```

---

## 기술 결정

### 왜 localStorage + HTML lang 속성인가?
- localStorage: 사용자 선택 영속화 (새로고침해도 유지)
- `<html lang="ko">`: 브라우저/스크린리더가 인식 (접근성, SEO, 스타일링 가능)

### 왜 fallback chain (현재 언어 → ko → en → 키)인가?
- 점진적 마이그레이션 허용 (모든 키가 3언어 번역될 때까지 기다릴 필요 없음)
- 미번역 키는 한국어 폴백, 한국어도 없으면 영어, 모두 없으면 키 표시

### 왜 data-i18n 속성인가? (별도 JS 시스템 아님)
- 간단 + 성능 (DOM 스캔 1회, 복잡한 state 관리 불필요)
- 기존 HTML과의 호환성 (data-* 속성은 표준, 안전)
- 타 프레임워크 (React, Vue) 마이그레이션 시에도 쉬운 전환 경로

---

## 결론

R16a 완료로 MaKIT의 다국어 지원 기반이 확립되었습니다. index.html 샘플 패턴을 따라 나머지 8개 HTML을 점진적으로 마이그레이션하면 4개 라운드(R17a~R17d) 안에 전체 플랫폼 다국어화 가능합니다. 백엔드 측에서도 에러 메시지 및 알림을 i18n 키 기반으로 전송하면, 완전한 다국어 경험을 제공할 수 있습니다.

**핵심 성과**:
- ✅ 3언어 사전 (~80 key-value 쌍, ko/en/ja)
- ✅ 동적 번역 엔진 (t(), setLocale(), data-i18n 속성)
- ✅ 글로벌 언어 선택기 UI (우상단, 반응형, 다크모드)
- ✅ 샘플 마이그레이션 (index.html 5개 요소)
- ✅ CSS 스타일 (D1 토큰 완전 사용)
