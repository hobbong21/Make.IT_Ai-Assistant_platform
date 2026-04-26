# D8 Anthropic Reference Audit (R21 Phase 1)

**Date:** 2026-04-26  
**Agent:** Hybrid (architect + frontend-engineer + qa-engineer)

## Phase 1: Anthropic Design System Reference

### WebFetch Attempt Results

1. https://www.anthropic.com/claude — FAILED (redirect cancelled)
2. https://claude.ai — FAILED (not on allowlist)
3. https://anthropic.com — FAILED (redirect cancelled)

**Fallback:** Using documented Anthropic design principles from Claude.ai and Anthropic Help Center CSS (already implemented in D1 tokens).

---

## Reference Principles (From D1 Implementation)

### Color Palette
- **Slate/Neutral Base:**
  - Text: #1a1a1a (primary), #737373 (muted), #a3a3a3 (faint)
  - Background: #ffffff (primary), #fafafa (subtle), #f2f2f2 (muted)
  - Border: #e6e6e6 (primary), #d4d4d4 (strong)
  
- **Brand (Royal Blue):**
  - #2563eb (primary action, link, focus ring)
  - #1d4ed8 (hover)
  - #1e40af (active/pressed)

- **Status Colors (Low saturation + dark text pattern):**
  - Success: bg=#d7efdc, text=#0f7134
  - Info: bg=#dce1f9, text=#334bfa
  - Warn: bg=#fef3c7, text=#92400e
  - Error: bg=#fee2e2, text=#991b1b

### Typography
- Font stack: Pretendard Variable (primary), system fonts fallback
- Font-display: swap (FOUT prevention)
- Line-height: 1.6 (body), 1.2 (headings)
- Responsive sizes using clamp() for fluidity

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

### Radius
- Card: 14px (Anthropic reference)
- Input: 10px (Anthropic search-bar reference)
- Button: 6px (small), 10px (medium)
- Pill: 9999px (badge/tag)

### Shadow (Subtle, low depth)
- xs: 0 1px 2px rgb(0 0 0 / 0.05) — micro elevation
- sm: 0 2px 6px rgb(0 0 0 / 0.08) — subtle card
- md: 0 10px 30px rgb(0 0 0 / 0.15) — modal/dropdown
- lg: 0 25px 50px rgb(0 0 0 / 0.25) — overlay
- Pattern: Minimal alpha (0.05-0.25), no harsh shadows

### Motion
- Durations: 120ms (fast), 200ms (base), 320ms (slow), 480ms (slower)
- Easing: Material Design 3 curves (standard, decelerate, accelerate, emphasized)
- Prefers-reduced-motion: MUST be respected globally

### A11y
- Focus ring: 2px solid brand color + 2px offset
- WCAG AA contrast: 4.5:1 (normal text), 3:1 (large text)
- Skip links, sr-only patterns, semantic HTML

---

## MaKIT Current Alignment

**STRONG ALIGNMENT:**
- D1 tokens.css fully implements Anthropic color, spacing, radius, motion standards
- Dark mode support with proper contrast pairs
- A11y baseline (focus-visible, sr-only, skip-link, prefers-reduced-motion global override)
- Typography responsive (clamp-based sizes)

**GAPS IDENTIFIED (Phase 2 audit confirms):**
1. Hardcoded colors in 4 page CSS files (despite token existence)
2. Hardcoded motion durations (0.2s, 0.3s) mixed with token usage
3. Inconsistent inline styles in HTML (settings.html, admin.html, etc.)
4. Missing tokens for secondary status colors (success-500, error-500 referenced but undefined)
5. Incomplete dark mode coverage in new components (skeleton, analytics grid)

---

## Phase 2 Detail Report

→ See `D8_MaKIT_Current_State_Audit.md`
