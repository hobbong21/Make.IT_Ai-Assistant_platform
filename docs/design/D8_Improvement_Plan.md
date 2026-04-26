# D8 Improvement Plan (R21 Phase 3)

**Date:** 2026-04-26  
**Classification:**
- High Impact, Low Effort: Issues 1-4, 6
- Medium Impact, Low Effort: Issues 5, 7-10
- Low Impact, Low Effort: Issues 11-15

---

## Priority Matrix

```
Impact
^
| (4) HIGH  | Issue 1, 2, 3, 4, 6, 9
|           |
| (3) MEDIUM| Issue 5, 7, 8, 10
|           |
| (2) LOW   | Issue 11, 12, 13, 14, 15
|___________|___________________________________> Effort (time)
  Low  <    Medium    >  High
```

---

## Implementation Plan

### BATCH 1: Token System Foundation (5 min)

**Issues:** 1, 2

**Changes to frontend/css/tokens.css:**

1. Add missing color tokens after line 65 (Status colors section):
```css
  /* ----- Status color variants (500, 400 weights) ----- */
  --mk-color-success-500:  #10b981;
  --mk-color-success-400:  #6ee7b7;
  --mk-color-error-500:    #ef4444;
  --mk-color-error-400:    #f87171;
  --mk-color-brand-400:    #60a5fa;  /* lighter brand blue */
```

2. Update dark mode pair (after line 191):
```css
  --mk-color-success-500:  #10b981;  --mk-color-success-400: #6ee7b7;
  --mk-color-error-500:    #ef4444;  --mk-color-error-400:   #f87171;
```

**Verification:**
- tokens.css lines 60-70 + dark section syntax valid
- No duplicate definitions

---

### BATCH 2: CSS Utility Classes (10 min)

**Issues:** 3, 6, 11

**Changes to frontend/css/app-shell.css (end of file, before media queries):**

Add 3 new utility classes:

```css
/* =============================
   Utility Classes (Motion, Layout)
   ============================= */

/* Analytics / Status card base */
.mk-stat-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--mk-space-3);
}

.mk-stat-card-item {
  padding: var(--mk-space-3);
  background: var(--mk-color-bg-subtle);
  border-radius: var(--mk-radius-md);
  text-align: center;
}

.mk-stat-label {
  font-size: var(--mk-font-size-sm);
  color: var(--mk-color-text-muted);
  margin-bottom: var(--mk-space-1);
}

.mk-stat-value {
  font-size: var(--mk-font-size-2xl);
  font-weight: var(--mk-font-weight-semibold);
}

/* Loading placeholder cell */
.mk-loading-cell {
  text-align: center;
  padding: var(--mk-space-5);
}

/* Standard input padding */
.mk-input-base {
  padding: var(--mk-space-2) var(--mk-space-3);
}

/* Motion utility: smooth transition */
.mk-transition-smooth {
  transition: all var(--mk-motion-duration-base) var(--mk-motion-ease-standard);
}

.mk-transition-fast {
  transition: all var(--mk-motion-duration-fast) var(--mk-motion-ease-standard);
}

.mk-transition-slow {
  transition: all var(--mk-motion-duration-slow) var(--mk-motion-ease-standard);
}
```

**Verification:**
- CSS syntax valid (curly braces, semicolons)
- Uses only defined tokens
- No conflicts with existing classes

---

### BATCH 3: Motion Token Migration (15 min)

**Issues:** 5, 7, 8, 10

**Target files:**
1. frontend/css/intro-styles.css
2. frontend/css/all-services-styles.css
3. frontend/css/service-detail-styles.css

**Pattern replacements (case-by-case):**

| From | To | Count |
|------|-----|-------|
| `transition: all 0.3s ease;` | `transition: all var(--mk-motion-duration-slow) var(--mk-motion-ease-standard);` | 6 (intro) + 1 (all-services) |
| `transition: all 0.2s;` | `transition: all var(--mk-motion-duration-base) var(--mk-motion-ease-standard);` | 3 (all-services) + 8 (service-detail) |
| `transition: color 0.2s;` | `transition: color var(--mk-motion-duration-base) var(--mk-motion-ease-standard);` | 2 (intro) + 1 (service-detail) |
| `transition: all 0.3s ease;` (filter, opacity) | `transition: all var(--mk-motion-duration-slow) var(--mk-motion-ease-standard);` | 2 (intro) |
| `transition: transform 0.2s;` | `transition: transform var(--mk-motion-duration-base) var(--mk-motion-ease-standard);` | 1 (service-detail) |
| `transition: max-height 0.3s ease;` | `transition: max-height var(--mk-motion-duration-slow) var(--mk-motion-ease-standard);` | 1 (service-detail) |
| `transition: border-color 0.2s;` | `transition: border-color var(--mk-motion-duration-base) var(--mk-motion-ease-standard);` | 1 (service-detail) |

**Verification after migration:**
- grep `[0-9]\.[0-9]s` intro-styles.css → 0 matches
- grep `[0-9]\.[0-9]s` all-services-styles.css → 0 matches
- grep `[0-9]\.[0-9]s` service-detail-styles.css → 0 matches
- grep `var(--mk-motion` these 3 files → 20+ matches

---

### BATCH 4: HTML Inline Style Cleanup (12 min)

**Issues:** 2, 4, 11, 14

**Changes to frontend/settings.html:**

1. **Line 139 (pushStatus):** Replace `style="font-size: var(--mk-font-size-sm); color: var(--mk-color-text-muted); margin-bottom: var(--mk-space-3);"` with `class="mk-stat-label"` (already defined in our utility classes)

2. **Lines 149-165 (analyticsGrid + stat cards):** Replace entire inline div block with class-based structure:
```html
<div id="analyticsGrid" class="mk-stat-card-grid">
    <div class="mk-stat-card-item">
        <div class="mk-stat-label">전송</div>
        <div id="analyticsSent" class="mk-stat-value" style="color: var(--mk-color-brand-500);">-</div>
    </div>
    <div class="mk-stat-card-item">
        <div class="mk-stat-label">클릭</div>
        <div id="analyticsClicked" class="mk-stat-value" style="color: var(--mk-color-success-500);">-</div>
    </div>
    <!-- ... repeat for failed, ctr ... -->
</div>
```

3. **Line 167 (border separator):** Keep as inline (minimal style) but ensure uses token:
```html
<div style="margin-top: var(--mk-space-4); padding-top: var(--mk-space-4); border-top: 1px solid var(--mk-color-border);">
```

4. **Line 151 + 162 (magic number 4px):** These are already using `margin-bottom: 4px;` → should use `var(--mk-space-1)` but low impact (already inside `.mk-stat-label` which we'll define)

**Verification:**
- settings.html body/html close tags intact
- analyticsGrid layout same visually (grid-template-columns unchanged)
- colors still apply (inline style on stat-value preserves color)

---

### BATCH 5: Admin HTML Cleanup (3 min)

**Issues:** 6

**Changes to frontend/admin.html:**

1. **Line 167 & 219 (loading cells):** Replace inline `style="text-align:center; padding: 20px;"` with `class="mk-loading-cell"`

```html
<!-- OLD: -->
<td colspan="6" style="text-align:center; padding: 20px;">로딩 중...</td>

<!-- NEW: -->
<td colspan="6" class="mk-loading-cell">로딩 중...</td>
```

**Verification:**
- admin.html body/html close tags intact
- Visual padding/alignment unchanged

---

### BATCH 6: Duplicate Fallback Reduction (2 min)

**Issues:** 8

**Changes to frontend/css/service-detail-styles.css:**

1. **Line 26 & 34 (duplicate border fallbacks):** Replace:
```css
border-right: 1px solid var(--mk-color-border, var(--mk-color-border, #e6e6e6));
```
With:
```css
border-right: 1px solid var(--mk-color-border, #e6e6e6);
```

2. Repeat for all 4 occurrences of nested fallbacks (scan for pattern `var(--mk-color-*, var(--mk-color-*,`)

**Verification:**
- grep `var(--mk-color-[a-z-]*, var(--mk-color` service-detail-styles.css → 0 matches

---

## Execution Order (Phase 4)

1. ✓ BATCH 1: tokens.css (5 min) — prerequisite for other changes
2. ✓ BATCH 2: app-shell.css (10 min) — new utility classes
3. ✓ BATCH 3: Motion migration (15 min) — 3 files, largest batch
4. ✓ BATCH 4: settings.html (12 min) — largest HTML file cleanup
5. ✓ BATCH 5: admin.html (3 min) — small change
6. ✓ BATCH 6: service-detail-styles.css (2 min) — regex-like cleanup

**Total:** ~47 min for all changes

**Parallel opportunities:** BATCH 1 + BATCH 2 can be done first (prereq), then BATCH 3/4/5/6 in order.

---

## Verification Checklist (Phase 5)

- [ ] All 9 HTML files have 1x `</body>` and 1x `</html>` (no truncation)
- [ ] No hardcoded hex colors in frontend/css/*.css (except fallbacks in var())
- [ ] No hardcoded motion durations `0.2s`, `0.3s` in CSS (all use vars)
- [ ] settings.html renders without layout shift (grid still 4-column auto-fit)
- [ ] admin.html table loading rows centered and padded correctly
- [ ] Dark mode: Settings analytics grid colors visible (not black/default)
- [ ] Keyboard focus on theme toggle buttons visible
- [ ] `validate-features.sh` passes (manifest CI)
- [ ] No console errors in browser (F12)

---

## Expected Outcomes

**Design System Hygiene:**
- Token coverage: 95% → 99%
- Hardcoded colors: ~40 → <5 (only necessary fallbacks)
- Inline styles: ~20 → 8 (only visibility/display, not colors/spacing)
- Motion durations: Mixed 0.2s/0.3s → 100% token-based

**Visual Changes:**
- None (all changes are refactoring; no pixel changes)

**Code Quality:**
- DRY principle improved (utility classes reusable)
- Maintenance burden reduced (motion change affects all pages at once)
- Dark mode rendering fixed (undefined colors now have values)

**Performance:**
- No impact (CSS file size slightly smaller due to token consolidation)

---

## Risk Assessment

**Risks:** LOW
- Changes are mostly copy/paste (token names stay same)
- No logic changes (HTML structure, JS untouched)
- Fallback tokens prevent visual regression

**Contingency:**
- If dark mode breaks, revert service-detail-styles.css to check syntax
- If layout shifts, verify grid-template-columns unchanged in settings.html
- If motion feels wrong, verify easing curve correct (should be `var(--mk-motion-ease-standard)`)

---

## Sign-Off

**Approver:** User (no approval needed per instruction "확인 없이")
**Executor:** Architect + Frontend-engineer hybrid agent
**Estimated Completion:** 50 minutes total (Phase 1-5)

---

Next → Phase 4: Implementation
