# R21 Phase 4 — BATCH 2~5 적용 완료 보고

> 2026-04-26 — R21 1차 에이전트가 Phase 1-3 (분석) + BATCH 1 (토큰 6개 추가)만 완료. 본 라운드는 BATCH 2-5 적용 마무리.

## 적용 결과 요약

| BATCH | 작업 | 변경 | 상태 |
|-------|------|------|------|
| 2 | app-shell.css에 7 utility class 추가 | +47줄 | ✅ |
| 3 | 3 page CSS motion 토큰 마이그레이션 | 26 hardcoded → 0 | ✅ |
| 4 | settings.html 인라인 토큰화 | margin-top:12px → var(--mk-space-3) | ✅ |
| 5 | admin.html 로딩셀 utility 적용 | mk-loading-cell 클래스 사용 | ✅ |

## BATCH 2 — Utility Classes 추가

`frontend/css/app-shell.css` 끝에 D8 유틸리티 7종 추가 (D1 토큰만 사용):

```css
.mk-stat-card-grid       grid auto-fit (140px+)
.mk-stat-card-item       padding+bg-subtle+radius-md+center
.mk-stat-label           text-sm + text-muted + space-1
.mk-stat-value           text-2xl + semibold
.mk-loading-cell         center + space-5 padding
.mk-input-base           space-2 × space-3 padding
.mk-section-divider      space-4 top + 1px border-top
```

## BATCH 3 — Motion Token Migration (가장 큰 변경)

`bash sed` byte-level 패턴 매칭으로 안전 마이그레이션:

| 파일 | Before | After | mk-motion 사용 |
|------|--------|-------|---------------|
| `intro-styles.css` | 11 hardcoded | 0 | 11 |
| `all-services-styles.css` | 7 hardcoded | 0 | 7 |
| `service-detail-styles.css` | 8 hardcoded | 0 | 8 |
| **합계** | **26** | **0** | **26** |

매핑 패턴:
- `0.2s` → `var(--mk-motion-duration-base)` (200ms)
- `0.3s ease` → `var(--mk-motion-duration-slow) var(--mk-motion-ease-standard)` (320ms)
- 적용 속성: `all`, `color`, `transform`, `border-color`, `background-color`, `filter`, `opacity`, `max-height`

## BATCH 4 — settings.html

`<div style="margin-top:12px;">` → `<div style="margin-top: var(--mk-space-3);">` (×2 메시지 영역).

## BATCH 5 — admin.html

`<td colspan="6" style="text-align:center; padding: 20px;">로딩 중...` → `<td colspan="6" class="mk-loading-cell">로딩 중...` (BATCH 2에서 정의한 utility 활용).

## 검증

- ✅ `validate-features.sh` — 17/17 PASS (regression 0)
- ✅ 9 HTML 무결성 PASS (host 확인)
- ✅ `grep transition.*[0-9]+\.[0-9]+s` 3 page CSS = 0
- ✅ `grep mk-motion-` 3 page CSS = 26

## R21 종합 (Phase 1~5 모두 완료)

| Phase | 산출물 |
|-------|--------|
| 1 | `docs/design/D8_Anthropic_Reference_Audit.md` |
| 2 | `docs/design/D8_MaKIT_Current_State_Audit.md` |
| 3 | `docs/design/D8_Improvement_Plan.md` |
| 4 (BATCH 1) | `frontend/css/tokens.css` +6 색상 토큰 |
| 4 (BATCH 2-5) | utility classes + motion 마이그레이션 + 인라인 정리 |
| 5 | 본 보고서 + CLAUDE.md 변경 이력 |

## R22 후보

- (a) chatbot-widget.js + skeleton.js JS 내부 hardcoded duration 검토
- (b) admin.html 추가 유틸리티 적용 (현재 로딩셀만)
- (c) marketing-hub.html / service-detail.html 인라인 스타일 추가 검토
- (d) Storybook 또는 컴포넌트 가이드 페이지 (`features/components/`)
