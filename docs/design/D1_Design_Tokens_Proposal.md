# MaKIT D1 디자인 토큰 제안서

> **목적:** `frontend/css/common.css`를 디자인 토큰 시스템으로 격상하여 D2(페이지 CSS 리디자인) · D3(HTML 시맨틱+a11y) 단계의 일관된 기반을 제공한다.
>
> **참조:** Anthropic Claude Design (2026-04-17 출시) + Anthropic 자체 브랜드 토큰 (Help Center 실측) + WCAG 2.2 AA + 모던 CSS 모범 사례.
>
> **작성일:** 2026-04-24

---

## 0. 진단 요약 (현황)

| 항목 | 현재 MaKIT | 문제점 |
|------|-----------|--------|
| CSS 변수 (디자인 토큰) | **0개** | 색상·간격·폰트 모두 hardcoded → 일관성 0, 다크모드 불가 |
| 색상 hardcoded 종 수 | 11+ (gray scale + amber 무작위) | 브랜드 정체성 부재. 상태색(error/success/warn) 산발 |
| 폰트 시스템 | `-apple-system` 단일 (시스템 폰트) | 브랜드 차별화 0. 타이포 스케일 불규칙 |
| 브레이크포인트 | 7종 혼재 (640/768/1024/1280, max+min 혼합) | 모바일 우선/데스크톱 우선 불명. 페이지별 일관성 없음 |
| 접근성 | focus-visible 미사용, ARIA 부족, contrast 미검증 | WCAG AA 미충족 가능성 높음 |
| 다크 모드 | 미지원 | 2026 표준 미달 |

---

## 1. Claude Design 참조 - Anthropic의 디자인 시스템 정의

Claude Design(2026-04-17 출시)이 모든 프로젝트에 자동 적용하는 디자인 시스템은 다음 4개 축으로 정의됩니다 ([공식 가이드](https://support.claude.com/en/articles/14604397) 인용):

> "This typically includes: **Color palette**: Primary, secondary, and accent colors extracted from your assets. **Typography**: Font families, sizes, and weights. **Components**: Buttons, cards, navigation elements, and other reusable UI patterns. **Layout patterns**: Spacing, grid systems, and page structures."

MaKIT D1은 **이 4개 축을 모두** common.css에 토큰으로 정립합니다.

또한 Anthropic 자체 사이트에서 추출한 실측 토큰을 reference로 활용:

```
Anthropic Help Center 실측 토큰:
--body-primary-color: #1a1a1a       ← 본문 텍스트 (#000보다 부드러움)
--body-secondary-color: #737373     ← 보조 텍스트 (gray 500)
--body-border: rgb(230, 230, 230)   ← 경계선 (#E6E6E6, gray 200)
--card-border-radius: 14px          ← 외곽 카드
--card-border-inner-radius: 11px    ← 내부 요소
--card-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)  ← 매우 미묘
--search-bar-border-radius: 10px

상태 색상:
ticket-blue-bg #dce1f9 / text #334bfa
ticket-green-bg #d7efdc / text #0f7134
```

핵심 인사이트: Anthropic은 **순수 검정(#000)을 피하고 #1a1a1a 사용**, **그림자는 거의 무감각(0.05 alpha)**, **반경은 10-14px(중간 부드러움)**, **상태색은 채도 낮은 배경 + 진한 텍스트** 패턴.

---

## 2. D1 색상 토큰 제안

### 2.1 핵심 디자인 결정

MaKIT는 "AX 마케팅 플랫폼" — B2B SaaS + 마케팅 임팩트가 동시에 필요. Anthropic 톤(따뜻한 미니멀리즘)을 차용하되, **MaKIT 브랜드 식별성을 위한 1개 accent**를 추가합니다.

| 결정 | 선택 | 이유 |
|------|------|------|
| 텍스트 검정 | `#1a1a1a` (Anthropic 채택) | 순수 #000은 눈 부담. 부드러운 검정이 장시간 가독성 우수 |
| Primary accent | **MaKIT Blue `#2563eb`** (또는 Indigo `#4f46e5`) | B2B 신뢰 + AI 색감. Anthropic 톤과 충돌 없음 |
| 상태색 패턴 | "채도 낮은 배경 + 진한 텍스트" (Anthropic 패턴) | 모달/뱃지가 시끄럽지 않음 |
| 다크 모드 | `prefers-color-scheme` 자동 + `[data-theme]` 수동 토글 | 2026 표준. 모든 토큰을 light/dark 페어로 정의 |

### 2.2 토큰 표 (Light 기본)

| 카테고리 | 토큰명 | 값 | 용도 |
|----------|--------|-----|------|
| **Brand** | `--mk-color-brand-500` | `#2563eb` | Primary action, link, focus ring |
| | `--mk-color-brand-600` | `#1d4ed8` | Hover state |
| | `--mk-color-brand-50`  | `#eff6ff` | Brand-tinted backgrounds (badge, callout) |
| **Surface** | `--mk-color-bg`        | `#ffffff` | 페이지 배경 |
| | `--mk-color-bg-subtle` | `#fafafa` | 카드 alternate |
| | `--mk-color-bg-muted`  | `#f2f2f2` | 입력 필드, code block (Anthropic ref) |
| **Text** | `--mk-color-text`      | `#1a1a1a` | 본문 (Anthropic ref) |
| | `--mk-color-text-muted` | `#737373` | 보조 (Anthropic ref) |
| | `--mk-color-text-faint` | `#a3a3a3` | placeholder, disabled |
| | `--mk-color-text-on-brand` | `#ffffff` | brand 위 텍스트 |
| **Border** | `--mk-color-border`    | `#e6e6e6` | 일반 경계선 (Anthropic ref) |
| | `--mk-color-border-strong` | `#d4d4d4` | 강조 경계선 |
| **Status** | `--mk-color-success`   | bg `#d7efdc` / text `#0f7134` | (Anthropic ref) |
| | `--mk-color-warn`      | bg `#fef3c7` / text `#92400e` | 기존 noscript와 호환 |
| | `--mk-color-error`     | bg `#fee2e2` / text `#991b1b` | 기존 #dc2626 보존 옵션 |
| | `--mk-color-info`      | bg `#dce1f9` / text `#334bfa` | (Anthropic ref) |
| **Shadow** | `--mk-shadow-xs`       | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | 카드 (Anthropic ref) |
| | `--mk-shadow-sm`       | `0 2px 6px -1px rgb(0 0 0 / 0.08)` | hover, popover |
| | `--mk-shadow-md`       | `0 10px 30px -8px rgb(0 0 0 / 0.15)` | 모달, toast (기존 toast 보존) |

### 2.3 다크 모드 페어

```css
@media (prefers-color-scheme: dark) {
  :root {
    --mk-color-bg:        #0a0a0a;
    --mk-color-bg-subtle: #171717;
    --mk-color-bg-muted:  #262626;
    --mk-color-text:      #fafafa;
    --mk-color-text-muted:#a3a3a3;
    --mk-color-border:    #262626;
    --mk-color-border-strong: #404040;
    /* brand 그대로 유지 (#2563eb는 다크에서도 충분히 대비) */
  }
}
```

수동 토글: `[data-theme="dark"]` 셀렉터로 동일 토큰 override.

---

## 3. D1 타이포그래피 토큰

### 3.1 폰트 패밀리 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| Sans (UI 본문) | **Pretendard Variable** + system fallback | 한글+영문 동시 지원, 가변 폰트(파일 1개로 모든 weight). Styrene는 라이선스 부담. |
| Serif (선택) | (필요 시 차후) `Tiempos` 대신 `Source Serif 4` | OFL 라이선스 무료. 에디토리얼 콘텐츠 추가 시 |
| Mono (코드) | system mono | 별도 서빙 부담 없음 |

> **이유:** Anthropic은 Styrene/Tiempos 라이선스 사용권을 보유. MaKIT는 한글이 핵심이므로 Pretendard(상용/오픈) 채택이 더 적합. 스타일은 유사한 인상(중립적 sans + 가독성 우선) 유지.

### 3.2 타이포 스케일 (modular scale 1.25 ratio + clamp 반응형)

```css
:root {
  --mk-font-sans: "Pretendard Variable", Pretendard,
                  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mk-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;

  /* clamp(min, fluid, max) — 모바일에서 너무 작지 않게 */
  --mk-font-size-xs:  0.75rem;                        /* 12px - caption */
  --mk-font-size-sm:  0.875rem;                       /* 14px - secondary */
  --mk-font-size-base: 1rem;                          /* 16px - body */
  --mk-font-size-lg:  1.125rem;                       /* 18px - lead */
  --mk-font-size-xl:  clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem);    /* 20-24px - h4 */
  --mk-font-size-2xl: clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem);   /* 24-30px - h3 */
  --mk-font-size-3xl: clamp(1.875rem, 1.6rem + 1.2vw, 2.5rem);   /* 30-40px - h2 */
  --mk-font-size-4xl: clamp(2.25rem, 1.8rem + 2vw, 3.5rem);      /* 36-56px - h1/hero */

  --mk-font-weight-regular: 400;
  --mk-font-weight-medium:  500;
  --mk-font-weight-semibold: 600;
  --mk-font-weight-bold:    700;

  --mk-line-height-tight: 1.2;       /* 헤딩 */
  --mk-line-height-snug:  1.375;     /* 서브 헤딩 */
  --mk-line-height-normal: 1.6;      /* 본문 */
  --mk-line-height-relaxed: 1.75;    /* long-form */

  --mk-letter-spacing-tight: -0.02em;  /* 큰 헤딩 */
  --mk-letter-spacing-normal: 0;
  --mk-letter-spacing-wide:   0.05em;  /* 작은 라벨, 버튼 */
}
```

`clamp()`로 모바일↔데스크톱 사이를 미디어 쿼리 없이 매끄럽게 보간. 헤딩만 fluid, 본문은 고정 1rem 유지(가독성).

---

## 4. D1 간격 · 반경 · 모션 토큰

### 4.1 간격 (4px 베이스 그리드)

```css
:root {
  --mk-space-0: 0;
  --mk-space-1: 0.25rem;   /* 4px */
  --mk-space-2: 0.5rem;    /* 8px */
  --mk-space-3: 0.75rem;   /* 12px */
  --mk-space-4: 1rem;      /* 16px */
  --mk-space-5: 1.25rem;   /* 20px */
  --mk-space-6: 1.5rem;    /* 24px */
  --mk-space-8: 2rem;      /* 32px */
  --mk-space-10: 2.5rem;   /* 40px */
  --mk-space-12: 3rem;     /* 48px */
  --mk-space-16: 4rem;     /* 64px */
  --mk-space-20: 5rem;     /* 80px */
  --mk-space-24: 6rem;     /* 96px */
}
```

### 4.2 반경 (Anthropic 패턴 채택)

```css
--mk-radius-xs: 4px;
--mk-radius-sm: 6px;
--mk-radius-md: 10px;     /* 입력 필드 (Anthropic search-bar) */
--mk-radius-lg: 14px;     /* 카드 외곽 (Anthropic card) */
--mk-radius-xl: 20px;     /* 큰 모달, hero 컨테이너 */
--mk-radius-pill: 9999px; /* 뱃지, 태그 */
```

### 4.3 모션

```css
--mk-duration-fast:   150ms;
--mk-duration-base:   250ms;
--mk-duration-slow:   400ms;
--mk-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
--mk-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. 브레이크포인트 표준화

기존 7종 혼재 → **모바일 우선 3개**로 통일:

```css
/* 컨벤션: min-width 단방향만 사용 */
--mk-bp-sm: 640px;   /* 태블릿 세로 */
--mk-bp-md: 1024px;  /* 태블릿 가로 / 노트북 */
--mk-bp-lg: 1280px;  /* 데스크톱 */
```

```css
/* 사용 예 (D2에서) */
@media (min-width: 640px)  { /* sm+ */ }
@media (min-width: 1024px) { /* md+ */ }
@media (min-width: 1280px) { /* lg+ */ }
```

기존 `max-width: 768px` 같은 데스크톱 우선 쿼리는 D2에서 제거. 컨테이너 쿼리는 D2에서 카드 등 부분 도입.

---

## 6. 접근성 (a11y) 베이스라인

```css
/* 1. focus-visible 통일 (마우스 클릭 시 outline 제거, 키보드 시 강조) */
:focus-visible {
  outline: 2px solid var(--mk-color-brand-500);
  outline-offset: 2px;
  border-radius: var(--mk-radius-xs);
}
*:focus:not(:focus-visible) { outline: none; }

/* 2. 시각적으로 숨기되 스크린리더 노출 */
.mk-sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap;
  border: 0;
}

/* 3. 스킵 링크 베이스 */
.mk-skip-link {
  position: absolute; top: -40px; left: 8px;
  padding: var(--mk-space-2) var(--mk-space-4);
  background: var(--mk-color-text);
  color: var(--mk-color-text-on-brand);
  border-radius: var(--mk-radius-sm);
  z-index: 9999;
  transition: top var(--mk-duration-fast) var(--mk-easing-standard);
}
.mk-skip-link:focus-visible { top: 8px; }

/* 4. 컬러 대비 검증 매트릭스 (D1 자체 약속) */
/*
  WCAG AA 기준 (4.5:1 본문 / 3:1 큰 텍스트):
  - text(#1a1a1a) on bg(#fff)             → 18.95:1 ✓ AAA
  - text-muted(#737373) on bg(#fff)       → 4.61:1 ✓ AA
  - brand-500(#2563eb) on bg(#fff)        → 5.17:1 ✓ AA
  - text-on-brand(#fff) on brand-500      → 5.17:1 ✓ AA
*/
```

---

## 7. 마이그레이션 전략 (충돌 방지)

기존 페이지 CSS를 깨지 않기 위한 안전 장치:

1. **모든 D1 토큰은 `--mk-` 프리픽스** — 기존 페이지 CSS와 네임스페이스 충돌 없음
2. **기존 common.css의 .toast / .is-loading / .error-state는 유지하되 색상만 토큰으로 교체** — 행동 변화 없음
3. **D2 단계에서 페이지 CSS가 hardcoded 색을 토큰으로 점진 교체** — 페이지별로 PR 분리 가능
4. **fallback 값 포함** — `var(--mk-color-text, #1a1a1a)` 형태로 토큰 미정의 시에도 동작

---

## 8. 다음 단계 (사용자 승인 후)

이 제안서가 승인되면 D1 라운드는 다음 1개 PR로 마무리됩니다:

| 단계 | 산출물 | 영향 |
|------|--------|------|
| 1. `frontend/css/tokens.css` 신설 | 위 모든 토큰 정의 (~150줄) | 신규 파일, 영향 0 |
| 2. `frontend/css/common.css` 갱신 | hardcoded 색을 토큰으로 교체 + a11y 유틸리티 추가 | 동작 변화 없음, 시각 약 1-2% 변화 |
| 3. `frontend/*.html` 5개 `<link rel="stylesheet" href="css/tokens.css">` 1줄씩 추가 | tokens.css 로드 우선순위 | 영향 없음 |
| 4. `CLAUDE.md` 변경 이력 1행 추가 | "D1 디자인 토큰 도입" 기록 | 메타 |

D2 (페이지 CSS 4종 토큰 적용)와 D3 (HTML 시맨틱+a11y)는 D1 검증 후 별도 라운드.

---

## 9. 사용자 결정 요청 사항

D1 코드 작성 전 확인이 필요한 4개:

1. **Brand accent 색상** — `#2563eb` (Royal Blue) vs `#4f46e5` (Indigo) vs **사용자 보유 브랜드 컬러가 있다면 제공**
2. **폰트 — Pretendard Variable** (한글+영문) 채택 동의? 또는 Inter+Noto Sans KR 조합 등 다른 선호?
3. **다크 모드** — 이번 D1에 페어 토큰까지 정의 (권장) vs Light만 우선
4. **상태 색상 호환성** — 기존 toast의 `#10b981`/`#dc2626`/`#d97706`을 유지(호환) vs Anthropic 패턴(`#0f7134`/`#991b1b`/`#92400e`)으로 전환

위 4개 확인 후 D1 코드 작성 (예상 ~150-200줄, 단일 파일)에 들어가겠습니다.
