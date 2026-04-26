# D8 MaKIT Current State Audit (R21 Phase 2)

**Date:** 2026-04-26  
**Scope:** frontend/css/*.css (5 files), frontend/*.html (9 files), frontend/js/*.js

---

## Executive Summary

**Current State:** R20 (17 features, full i18n, PWA, push, skeleton, admin dashboard)

**Design Debt:** ~25-35 quick wins identified. Most are cosmetic (token migration) or structural (missing token definitions). No breaking changes needed.

---

## Detailed Findings by Category

### 1. Color Consistency Issues

**Hardcoded Hex in CSS (Despite Token Existence)**

| File | Issue | Count | Example |
|------|-------|-------|---------|
| admin.css | Fallback hex values in var() | 20+ | `var(--mk-color-bg, #fff)` |
| service-detail-styles.css | Duplicate fallbacks | 15+ | `var(--mk-color-border, var(--mk-color-border, #e6e6e6))` |
| intro-styles.css | Pure hardcoded values post-R10 | 8 | `#333`, `#4b5563`, `#fde68a` |
| all-services-styles.css | Mixed token/hardcoded | 5 | `#e5e7eb`, `#92400e` |

**Severity:** MEDIUM (visual consistency degraded in dark mode)

**Impact:** In dark mode, hardcoded fallback hex values show instead of dark tokens, breaking contrast.

---

### 2. Motion/Transition Inconsistency

**Hardcoded Durations Outside Token System**

| File | Duration | Count | Replace With |
|------|----------|-------|---------------|
| intro-styles.css | `transition: all 0.3s ease` | 6 | `transition: all var(--mk-motion-duration-slow) var(--mk-motion-ease-standard)` |
| intro-styles.css | `transition: color 0.2s` | 2 | `transition: color var(--mk-motion-duration-base) var(--mk-motion-ease-standard)` |
| all-services-styles.css | `transition: all 0.2s` | 3 | Same as above |
| all-services-styles.css | `transition: all 0.3s ease` | 1 | `--mk-motion-duration-slow` |
| service-detail-styles.css | `transition: *` mixed | 8 | Standardize to token durations |
| admin.css | `var(--mk-duration-base, 200ms) ease` | 3 | Already using tokens (GOOD) |

**Severity:** MEDIUM (motion system incomplete; prefers-reduced-motion still respected globally)

**Impact:** Page transitions inconsistent; easing curve library not used; hard to adjust site-wide motion globally.

---

### 3. Inline Styles in HTML

**Direct style= Attributes**

| File | Count | Examples | Category |
|------|-------|----------|----------|
| settings.html | 20+ | `style="margin-top:12px;"`, `style="display:none;"`, `style="padding: var(--mk-space-3, 12px);"` | Layout control + token hybrid |
| admin.html | 5 | `style="display:none;"`, `style="text-align:center; padding: 20px;"` | Visibility + magic numbers |
| login.html | 1 | `style="width:' + ((score / 4) * 100) + '%"` | JS-driven (hardcoded) |
| service-detail.html | 1 | `style="display:none;"` | Visibility control |

**Severity:** LOW-MEDIUM (mixing patterns; some use tokens, some hardcoded)

**Impact:** Maintenance burden; inline styles override CSS, making debugging harder.

---

### 4. Undefined Token References

**Colors Referenced but Not Defined in tokens.css**

| Reference | Used In | Status | Fix |
|-----------|---------|--------|-----|
| `--mk-color-success-500` | settings.html L156 | NOT DEFINED | Define in tokens.css |
| `--mk-color-error-500` | settings.html L160 | NOT DEFINED | Define in tokens.css |
| `--mk-color-brand-400` | settings.html L164 | NOT DEFINED | Define in tokens.css (lighter brand) |
| `--mk-color-success-bg` | Many | DEFINED | Use in dark mode pair |
| `--mk-color-success-text` | Many | DEFINED | Use in dark mode pair |

**Severity:** HIGH (runtime fallback to undefined = browser default black)

**Impact:** Color swatches in analytics display as black/invisible in dark mode.

---

### 5. Spacing Inconsistencies

**Magic Numbers Mixed with Token Usage**

| File | Example | Replace |
|------|---------|---------|
| settings.html | `margin-bottom: 4px;` (L151, L162) | `var(--mk-space-1)` |
| settings.html | `padding: 10px 12px;` (input) | `var(--mk-space-2) var(--mk-space-3)` |
| admin.html | `padding: 20px;` | `var(--mk-space-5)` |
| service-detail-styles.css | `margin-bottom: 4px;` | Token |

**Severity:** LOW (visual impact minimal; readability of 4px == 0.25rem acceptable)

**Impact:** Spacing not on perfect 4px grid in a few places; inconsistent with token philosophy.

---

### 6. Component Duplication / Inconsistency

**Same UI Pattern Styled Differently**

| Pattern | Location | Issue |
|---------|----------|-------|
| Status message cards | settings.html L150-165 (inline), admin.css (CSS class) | Duplicate styling; one inline, one class |
| Loading placeholder | admin.html L167 + L219 | Inline style `text-align:center; padding: 20px;` — no CSS class |
| Button styles | settings.html (inline button classes), admin.html (btn-primary) | Mixed patterns |

**Severity:** MEDIUM (maintenance overhead; inconsistent DRY principle)

**Impact:** Adding new analytics grid requires copying inline styles; harder to update button styles globally.

---

### 7. Dark Mode Coverage Gaps

**New Components Missing Dark Pairs**

| Component | File | Status | Issue |
|-----------|------|--------|-------|
| Analytics grid cards | settings.html L150 | Inline background only | Uses `--mk-color-bg-subtle` (good) but no dark-specific styling |
| Admin table | admin.css | CSS class | Dark theme defined in tokens.css; CSS ready |
| Skeleton loader | skeleton.js (CSS generated) | Inline style in JS | Hardcoded CSS in JS; doesn't use token durations |

**Severity:** LOW (system fallback works; just not optimized)

**Impact:** Skeleton shimmer might be visible in dark mode when it should adjust.

---

### 8. Focus Ring / Focus Handling

**Missing in Some Interactive Elements**

| Element | File | Status |
|---------|------|--------|
| Input fields | settings.html | Inline CSS `:focus { outline: none; border-color: ...; box-shadow: 0 0 0 3px rgb(37 99 235 / 0.15); }` |
| Theme toggle buttons | settings.html (`.theme-opt`) | Uses `transition: all var(--mk-duration-fast) ease;` (good) but no explicit `:focus-visible` |
| Admin buttons | admin.css | Inherit from tokens.css `:focus-visible` (good) |

**Severity:** LOW (base pattern works; some elements should be more explicit)

**Impact:** Keyboard navigation slightly awkward in settings page; theme buttons not visually distinct when focused.

---

### 9. Typography Token Usage

**Mostly Good; Minor Issues**

| File | Issue | Count |
|------|-------|-------|
| settings.html | Hardcoded `font-size: 0.875rem;` instead of `var(--mk-font-size-sm)` | 1 |
| admin.css | Using var(--mk-font-weight-bold, 700) (fallback) | 3 |
| all CSS | Typography tokens used correctly | 95%+ |

**Severity:** VERY LOW (typography system working well)

**Impact:** Minimal; main fonts/sizes use tokens correctly.

---

### 10. Missing Metadata / Document Meta Tags

**PWA & A11y Metadata**

| HTML | Current | Missing/Issue |
|------|---------|---------------|
| All 9 HTML | `<meta name="theme-color" content="#2563eb">` | Present |
| All 9 HTML | `<link rel="manifest">` | Present |
| All 9 HTML | `prefers-color-scheme` | Defined in tokens.css only (good) |
| marketing-hub.html | `lang="ko"` | Present |
| marketing-hub.html | Favicon | Not explicitly linked (inherited fallback) |

**Severity:** VERY LOW (PWA meta tags correct; favicon browser default works)

**Impact:** None; system functional.

---

## Top 15 Issues by Priority

### HIGH (4 issues)
1. **Add missing token definitions:** `--mk-color-success-500`, `--mk-color-error-500`, `--mk-color-brand-400` → admin.css should reference these, not fallback to undefined
2. **Fix settings.html analytics grid undefined colors** → reference color tokens instead of default to black
3. **Add `.mk-stat-card` utility class** → Extract inline styles from settings.html L150-165 into reusable CSS
4. **Standardize button padding** → Replace inline `padding: 10px 12px;` with token-based `padding: var(--mk-space-2) var(--mk-space-3);`

### MEDIUM (6 issues)
5. **Migrate intro-styles.css motion** → Replace 6x `0.3s ease` + 2x `0.2s` with motion tokens
6. **Migrate all-services-styles.css motion** → Replace 4x `0.2s` + 1x `0.3s` with tokens
7. **Migrate service-detail-styles.css motion** → Replace 8 hardcoded transitions
8. **Replace duplicate fallbacks in CSS** → service-detail-styles.css has `var(--mk-color-border, var(--mk-color-border, #e6e6e6))` — simplify to `var(--mk-color-border)`
9. **Extract admin.html inline styles to CSS class** → `.mk-loading-cell { text-align: center; padding: var(--mk-space-5); }`
10. **Add explicit :focus-visible to theme-opt buttons** → Improve keyboard navigation UX

### LOW (5 issues)
11. **Replace magic-number spacing** → `margin-bottom: 4px;` → `var(--mk-space-1)` (settings.html only 3 occurrences)
12. **Standardize analytics card borders** → Ensure border-color uses `var(--mk-color-border)` in dark mode
13. **Review skeleton.js CSS generation** → Ensure shimmer uses motion tokens if inline animation applied
14. **Add aria-expanded to theme toggle** → Accessibility refinement (non-critical)
15. **Document button padding breakpoint** → Settings buttons may need responsive padding on mobile

---

## Recommended Approach

**Phase 3:** Create improvement plan prioritizing quick wins (token additions, motion migration, class extraction).

**Phase 4:** Apply changes in this order:
1. Add 3 missing token definitions (5 min)
2. Create `.mk-stat-card`, `.mk-loading-cell` utility classes (10 min)
3. Migrate all motion durations to tokens across 3 page CSS files (10 min)
4. Extract analytics grid inline styles to CSS + fix color references (10 min)
5. Verify dark mode rendering, run `validate-features.sh` (5 min)

**Total estimated effort:** ~40-50 minutes for Phase 4.

---

## Files to Modify

- frontend/css/tokens.css (add 3 tokens)
- frontend/css/app-shell.css (add 2 utility classes + motion tokens)
- frontend/css/intro-styles.css (motion migration)
- frontend/css/all-services-styles.css (motion migration)
- frontend/css/service-detail-styles.css (motion migration + duplicate fallback fix)
- frontend/settings.html (inline style cleanup, remove analytics grid inline CSS)
- frontend/admin.html (extract `.mk-loading-cell` usage)

**No files to delete or rename.**

---

## Phase 3 Detail Report

→ See `D8_Improvement_Plan.md`
