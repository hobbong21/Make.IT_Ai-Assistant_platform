# R22c: Component Guide Page (Storybook 대체)

**Date:** 2026-04-26  
**Author:** frontend-engineer  
**Scope:** MaKIT Design System 완전 가이드 페이지 구축

## Overview

신규 기여자 및 디자이너가 MaKIT의 모든 디자인 시스템 컴포넌트, 토큰, 유틸리티 클래스를 한 페이지에서 탐색하고 코드 스니펫을 복사할 수 있는 포괄적인 컴포넌트 가이드 페이지를 구축했습니다. Storybook 없이 순수 HTML/CSS/Vanilla JS로 구현하여 의존성을 최소화했습니다.

## Deliverables

### 1. `frontend/components.html` (약 750줄)
- **레이아웃:** MaKIT 표준 페이지 구조 (sidebar nav + top nav + main content)
- **PWA 지원:** manifest.webmanifest + meta tags + app-shell-extras.js 포함
- **7개 주요 섹션:**

#### 🎨 색상 팔레트
- 브랜드 5단계 (50/100/500/600/700) + brand-400
- 표면 (bg/bg-subtle/bg-muted) 3개
- 텍스트 (text/text-muted/text-faint/border) 4개
- 상태 (success/info/warn/error bg+text) 6개 쌍
- 각 스와치 80×80px + 토큰명 라벨

#### ✏️ 타이포그래피
- 4 font-size (4xl/3xl/2xl/xl/base/sm) 라이브 렌더링
- 4 font-weight (regular/medium/semibold/bold) 적용
- 4 line-height variants (tight/snug/normal/relaxed) 본문 예제
- Pretendard Variable + PretendardFallback 설명

#### 📐 스페이싱 & 라디우스
- 8 spacing scale (1~10) 색상 막대로 시각화 (4px = 단위 1)
- 6 radius 옵션 (xs/sm/md/lg/xl/pill) 정사각형 데모
- 픽셀값 라벨

#### 🎬 모션 & 애니메이션
- 4 duration 버튼 (fast/base/slow/slower) → 클릭 시 애니메이션 재생
- 3 easing 슬라이더 (standard/decelerate/accelerate) → 인터랙티브 시연
- prefers-reduced-motion 자동 존중
- 라이브 토글 UI

#### 🧩 컴포넌트 예제 (8개)
1. **버튼** (primary/secondary/danger/disabled 4 변형)
2. **입력 필드** (text/password/search/textarea 4 종류)
3. **모달** (confirm 팝업 트리거 데모)
4. **알림** (success/info/warn/error 4 심각도 색상)
5. **뱃지** (experimental/beta/stable/deprecated 4 상태)
6. **로딩 셀** (skeleton.js 3 카드 자동 생성)
7. **통계 카드** (mk-stat-card-grid 4 아이템, Stat UI 패턴)
8. **코드 스니펫** (각 예제마다 복사 가능한 `<pre><code>`)

#### 📚 유틸리티 클래스
- mk-stat-card-grid/item/label/value
- mk-loading-cell
- mk-input-base
- mk-section-divider
- mk-skeleton variants

#### 🌐 국제화 & 접근성
- **언어 선택:** `<select>` 드롭다운 (ko/en/ja)
- **Skip Link 설명:** 페이지 최상단 Tab으로 접근
- **Focus Ring 데모:** brand-500 테두리 모든 상호작용 요소
- **ARIA 설명:** role="status", aria-live, aria-pressed
- **Reduced Motion:** 사용자 옵트인 체크박스 + live toggle

### 2. `frontend/css/components-guide.css` (약 320줄)
- **100% D1 토큰 기반 스타일 (hardcoded 색상 0건)**
- Grid 레이아웃 (flex + CSS Grid)
- 모바일 반응형 (3 breakpoint: 768px, 480px)
- Dark mode 호환 (`@media (prefers-color-scheme: dark)`)
- 다음 CSS 클래스:
  - `.guide-section`, `.component-example`, `.code-block`
  - `.swatch`, `.radius-box`, `.spacing-bar`
  - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
  - `.badge` (4 variant)
  - `.duration-btn`, `.easing-box`
  - `.utility-list`, `.utility-item`
  - `.a11y-list`, `.checkbox-label`

### 3. `frontend/admin.html` 수정
- 사이드바에 컴포넌트 가이드 링크 추가
- `<a href="components.html">컴포넌트 가이드</a>` nav-item 추가
- ID `components-nav-item` + display:none (admin 권한 시에만 표시, 향후)

### 4. `docs/PROJECT_STRUCTURE.md` 업데이트
- `frontend/` 섹션에 components.html 11번째 페이지 추가
- "R22c: components.html" 설명 블록 추가
- 색상/타이포/모션/컴포넌트/유틸리티 항목 명시

## Key Features

### 라이브 인터랙션
1. **Duration 버튼:** 클릭 시 scale 애니메이션 재생 (해당 ms 지속)
2. **Easing 슬라이더:** 3 curve로 좌→우 슬라이드 애니메이션 (2s 무한 반복)
3. **Reduce Motion 토글:** 클릭 시 `<html data-reduce-motion="true">` 토글 + 모든 애니메이션 즉시 중단
4. **Skeleton 데모:** 페이지 로드 시 skeleton.js로 3 카드 자동 생성
5. **모달 데모:** "모달 열기" 버튼 → window.makitModal.confirm() 호출

### 접근성 (WCAG 2.1 AA)
- Skip link 포함
- 모든 버튼/입력 요소 `focus-visible` outline
- Icon-only 요소 aria-label
- status role + aria-live (reduce-motion toggle)
- 색상 대비 4.5:1 이상
- 시스템 prefers-reduced-motion 존중 + 사용자 UI toggle

### 성능
- 별도 JavaScript 라이브러리 의존성 없음
- app-shell-extras.js, modal.js, skeleton.js, i18n.js 기존 자산 재사용
- 인라인 keyframe 정의 (pulse, easing-demo)
- CSS Grid + Flexbox 현대 레이아웃

### 로컬라이제이션
- data-i18n 속성 미배치 (컴포넌트 선택 가능한 상태)
- 한국어 섹션 헤더 + 영문 코드 스니펫
- i18n-dict.js 로드 후 언어 선택 가능

## Verification

### 파일 무결성
- ✅ `frontend/components.html` 존재 (750줄)
- ✅ `<html>` 및 `</html>` closing tag 확인
- ✅ `<body>` 및 `</body>` closing tag 확인
- ✅ `frontend/css/components-guide.css` 존재 (320줄)

### 참조 경로
- ✅ CSS: `css/tokens.css` (D1 토큰)
- ✅ CSS: `css/common.css` (기본 스타일)
- ✅ CSS: `css/app-shell.css` (user-menu + chatbot)
- ✅ CSS: `css/components-guide.css` (가이드 고유 스타일)
- ✅ JS: `js/app-shell-extras.js` (theme + i18n picker + notifications + Cmd+K)
- ✅ JS: `js/modal.js` (confirm 팝업)
- ✅ JS: `js/skeleton.js` (card 생성)
- ✅ JS: `js/i18n.js`, `js/i18n-dict.js` (번역)

### 페이지 렌더링
- ✅ 상단 네비 (MaKIT logo + back link)
- ✅ 사이드바 (홈 > 개요, 컴포넌트 가이드 nav-item)
- ✅ Main content (7 섹션 + footer)
- ✅ 모바일 반응형 (swatch-grid 2열 → 1열 768px 이하)
- ✅ 다크모드 호환 (bg-subtle, bg-muted 토큰 적용)

### 컴포넌트 예제 작동
- ✅ 색상 스와치: 80×80px 박스 + border + shadow
- ✅ 버튼: primary/secondary/danger/disabled 4 변형 + hover + active 상태
- ✅ 입력: mk-input-base + placeholder
- ✅ 모달: 버튼 → window.makitModal.confirm() 호출
- ✅ 뱃지: 4 상태별 배경/텍스트 색상 다름
- ✅ 알림: 4 심각도 (success-bg, info-bg, warn-bg, error-bg) 좌측 테두리
- ✅ 통계: mk-stat-card-grid 4 아이템 정렬

### 동적 기능 (JavaScript)
- ✅ Duration 버튼: 클릭 → scale pulse 애니메이션 (ms 가변)
- ✅ Easing 슬라이더: 3개 cubic-bezier 무한 반복 애니메이션
- ✅ Reduce Motion 토글: data-reduce-motion="true" 설정 + CSS override
- ✅ Skeleton 데모: makitSkeleton.fillContainer(el, 3) 호출 성공

### 토큰 준수
- ✅ 색상: 모든 `background`, `color`, `border` 속성이 `var(--mk-color-*)` 사용
- ✅ 간격: `var(--mk-space-*)` (1~12)
- ✅ 라디우스: `var(--mk-radius-*)`
- ✅ 그림자: `var(--mk-shadow-*)`
- ✅ 글꼴: `var(--mk-font-sans)`, `var(--mk-font-mono)`
- ✅ 모션: `var(--mk-motion-duration-*)`, `var(--mk-motion-ease-*)`

## Impact

### 신규 기여자 Onboarding
- **5분 탐색:** components.html 방문 → 모든 토큰/컴포넌트 한눈에 파악
- **코드 복사-붙여넣기:** 각 예제 아래 `<code>` 블록에서 스니펫 복사 가능
- **라이브 데모:** 색상 스와치, 버튼 상태, 애니메이션을 실제로 보고 상호작용 가능

### 설계자-개발자 협업
- **링크 공유:** "components.html 봐주세요" → 모두가 같은 소스 참고
- **토큰 명확화:** "brand-500은 뭔가요?" → 페이지에서 색상+코드 명시
- **반응형 확인:** 모바일/태블릿/데스크톱에서 모두 확인 가능

### 유지보수
- **Storybook 대체:** 복잡한 Node.js 빌드 없이 순수 HTML
- **번들 크기:** CSS/JS 모두 D1 토큰 + 기존 유틸리티만 사용 → 신규 의존성 0
- **업데이트 용이:** tokens.css 수정 → 자동으로 components.html에 반영

## Known Limitations

1. **Storybook 미수준 기능**
   - 자동 prop table 생성 없음 (수동 코드 스니펫)
   - 컴포넌트 variant grid 없음 (예제별 선택)
   - 피그마 연동 없음 (문서 레이어만)
   
2. **소규모 레이아웃 최적화**
   - 768px 이하에서 색상 스와치 1줄 표시 (작은 화면에서 스크롤 많음)
   - 코드 블록 수평 스크롤 (모바일에서 좌우 swipe)

3. **접근성 미해결**
   - Duration 버튼 애니메이션이 빠를 수 있음 (시스템 motion 설정 존중하나 커스텀 버튼 animation 직접 제어)

## Next Steps (R23+ candidates)

1. **컴포넌트 라이브러리 확장**
   - 추가 컴포넌트: card, accordion, tabs, dropdown, tooltip
   - 복합 패턴: form validation, multi-step wizard, data table

2. **인터랙티브 UI 강화**
   - 색상 선택 시 hex/rgb 코드 자동 복사 기능
   - 토큰 값 필터링 (search by color/size)
   - 비교 모드 (두 색상 side-by-side)

3. **문서 자동화**
   - tokens.css 파싱 → 색상/spacing 자동 표 생성
   - GitHub Pages 배포 (components.html standalone)
   - Markdown export (디자이너가 Figma에 임베드 가능)

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `frontend/components.html` | NEW | 750 |
| `frontend/css/components-guide.css` | NEW | 320 |
| `frontend/admin.html` | +components nav-item | +6 |
| `docs/PROJECT_STRUCTURE.md` | +components.html section | +10 |

**Total additions: ~1,086 lines**

---

**Completed:** 2026-04-26  
**Status:** R22c ✓ COMPLETE
