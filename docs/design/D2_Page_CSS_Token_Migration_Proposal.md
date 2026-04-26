# D2 페이지 CSS 토큰 마이그레이션 제안서

> **목적:** D1에서 정립한 `tokens.css` 50+ 토큰을 `frontend/css/`의 4 페이지 CSS(총 2439줄)에 일관 적용하여 시각·반응형·다크모드 일관성 완성.
>
> **참조:** D1 (`_workspace/design/D1_Design_Tokens_Proposal.md`), Anthropic Claude Design 가이드, R8 누적 변경 이력.
>
> **작성일:** 2026-04-25 (R8 완료 후, R9 전)

---

## 0. 진단 결과

| 파일 | 라인 | hardcoded 색 | mk-토큰 사용 | font-size hard | @media |
|------|------|-------------|------------|----------------|--------|
| `styles.css` (index 페이지) | 488 | **47건** | 0 | 19 | 4 |
| `intro-styles.css` | 784 | **77건** | 0 | 32 | 2 |
| `all-services-styles.css` | 412 | **43건** | 0 | 15 | 3 |
| `service-detail-styles.css` | 755 | 92건 | **60건** ✅ | 18 | 4 |
| **합계** | **2439** | **259건** | 60 (서비스만) | 84 | 13 |

**핵심 발견:**
- 3 페이지(styles/intro/all-services)는 **mk-토큰 0건** — D1 도입 후에도 마이그레이션 안 됨
- service-detail만 D1 chat-input form 작업 시 60건 토큰 사용 — 부분 적용 케이스
- styles.css의 hardcoded TOP: `#000` (9), `#e5e7eb` (8), `#6b7280` (7), `#fff` (3), `#1f2937` (3) — 모두 D1 토큰으로 교체 가능
- 미디어 쿼리 7종 혼재 — D1 표준(min 640/1024/1280) 미적용. `max-width: 768px` 같은 데스크톱-우선 쿼리 다수

---

## 1. 매핑 가이드 (D1 토큰 ↔ hardcoded)

### 1.1 색상 매핑

| Hardcoded | D1 토큰 | 의미 |
|-----------|---------|------|
| `#000`, `#1a1a1a`, `#1f2937`, `#111827` | `var(--mk-color-text)` | 본문 |
| `#374151`, `#333`, `#444` | `var(--mk-color-text)` 또는 `var(--mk-color-text-muted)` 케이스별 |
| `#6b7280`, `#737373` | `var(--mk-color-text-muted)` | 보조 |
| `#a3a3a3`, `#9ca3af` | `var(--mk-color-text-faint)` | placeholder |
| `#fff`, `#ffffff` | `var(--mk-color-bg)` 또는 `var(--mk-color-text-on-brand)` |
| `#fafafa`, `#f9fafb`, `#f8fafc` | `var(--mk-color-bg-subtle)` |
| `#f3f4f6`, `#f2f2f2` | `var(--mk-color-bg-muted)` |
| `#e5e7eb`, `#e6e6e6` | `var(--mk-color-border)` |
| `#d4d4d4`, `#d1d5db` | `var(--mk-color-border-strong)` |
| `#2563eb`, `#3b82f6` | `var(--mk-color-brand-500)` |
| `#1d4ed8` | `var(--mk-color-brand-600)` |
| `#eff6ff`, `#dbeafe` | `var(--mk-color-brand-50)` |
| `#10b981`, `#059669` | `var(--mk-color-success-text)` |
| `#dc2626`, `#ef4444` | `var(--mk-color-error-text)` |
| `#f59e0b`, `#d97706` | `var(--mk-color-warn-text)` |

### 1.2 간격(spacing)

기존 `padding: 16px`, `margin: 24px` 등 → `var(--mk-space-4)` (16px), `var(--mk-space-6)` (24px) 등.

### 1.3 반경

- `border-radius: 4px` → `var(--mk-radius-xs)`
- `6px` → `var(--mk-radius-sm)`
- `8px`, `10px` → `var(--mk-radius-md)`
- `12px`, `14px` → `var(--mk-radius-lg)`
- `20px` → `var(--mk-radius-xl)`
- `9999px`, `50%` (pill/circle) → `var(--mk-radius-pill)` 또는 그대로

### 1.4 타이포

폰트 크기 hardcoded → D1 토큰:
- `0.75rem`, `12px` → `var(--mk-font-size-xs)`
- `0.875rem`, `14px` → `var(--mk-font-size-sm)`
- `1rem`, `16px` → `var(--mk-font-size-base)`
- `1.125rem`, `18px` → `var(--mk-font-size-lg)`
- `1.25rem~1.5rem` → `var(--mk-font-size-xl)` (clamp 자동)
- `1.5rem~1.875rem` → `var(--mk-font-size-2xl)`
- 큰 헤드 (2rem+) → `var(--mk-font-size-3xl)` 또는 `4xl`

### 1.5 미디어 쿼리 통일

7종 혼재 → **3 표준**으로:

| 기존 | 변경 |
|------|------|
| `@media (max-width: 640px)` | `@media (max-width: 639px)` 유지 또는 `@media (min-width: 640px)` 반전 |
| `@media (max-width: 768px)` | `@media (max-width: 1023px)` (1024부터 데스크톱) |
| `@media (max-width: 1024px)` | `@media (max-width: 1023px)` |
| `@media (min-width: 768px)` | `@media (min-width: 640px)` (D1 sm 표준) |
| `@media (min-width: 1024px)` | `@media (min-width: 1024px)` 유지 (D1 md) |
| `@media (min-width: 1280px)` | `@media (min-width: 1280px)` 유지 (D1 lg) |

원칙: **모바일 우선 + min-width**로 통일.

---

## 2. 우선순위 + 시간 추정

| 단계 | 파일 | 라인 | hardcoded | 추정 시간 | 가치 |
|------|------|------|----------|----------|------|
| **D2-A** | `styles.css` (index) | 488 | 47 | 30분 | 🔥 대시보드 — 가장 많이 보임 |
| **D2-B** | `all-services-styles.css` | 412 | 43 | 25분 | ⭐ 서비스 카탈로그 — 두 번째로 많이 보임 |
| **D2-C** | `intro-styles.css` | 784 | 77 | 50분 | ✓ 랜딩 — 신규 사용자 첫 인상 |
| **D2-D** | `service-detail-styles.css` | 755 | 92 | 30분 | 일부 토큰화 완료 — 잔여 92건만 |

### 권장 순서
1. **D2-A 먼저** (index — 로그인 후 첫 화면, 가장 큰 임팩트)
2. **D2-B** (all-services — 서비스 사용 흐름의 허브)
3. **D2-C + D2-D** 병렬 (intro 랜딩 + service-detail 잔여)

---

## 3. 마이그레이션 워크플로우 (각 파일별 표준 절차)

```
1. 현재 파일 읽기 (Read)
2. 색상 hardcoded → 토큰 일괄 치환 (sed 또는 Edit, 위 §1.1 매핑 표)
3. spacing hardcoded → 토큰 (위 §1.2)
4. font-size → 토큰 또는 clamp (위 §1.4)
5. 반경 → 토큰 (위 §1.3)
6. 미디어 쿼리 → D1 표준 통일 (위 §1.5)
7. fallback 값 포함 — `var(--mk-color-text, #1a1a1a)` 형태로 토큰 미정의 시 동작 보장
8. 시각 회귀 검증 — 마이그레이션 전후 페이지 스크린샷 비교 (사용자 PC)
```

---

## 4. 위험 요소 & 완화

| 위험 | 완화 |
|------|------|
| 토큰 미정의 시 색 사라짐 | 모든 var() 호출에 fallback 값 포함 |
| 다크모드 미지원 영역 발생 | tokens.css의 dark mode pair가 자동 적용되므로 var() 사용 시 자동 호환 |
| 시각 회귀 (이전과 색 약간 다름) | 의도적 — D1 토큰은 Anthropic ref 기준이라 약간의 톤 변화는 정상 |
| 미디어 쿼리 변경으로 레이아웃 깨짐 | min-width 표준 채택 시 기존 max-width 룰의 카운터파트 추가 검증 필요 |
| 한국어 truncation 위험 (이전 사고 패턴) | bash sed 스크립트로 ASCII 영역만 치환, 한국어 줄은 건드리지 않음 |

---

## 5. 검증 매트릭스

각 파일 마이그레이션 후 점검:

```bash
# 토큰 사용률 (마이그레이션 후 50% 이상 목표)
grep -c 'var(--mk-' frontend/css/styles.css

# hardcoded 색 잔존 (마이그레이션 후 10건 이하 목표)
grep -cE '#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)' frontend/css/styles.css

# font-size hardcoded 잔존
grep -cE 'font-size:\s*[0-9]+(\.[0-9]+)?(px|rem)' frontend/css/styles.css

# UTF-8 무결성
iconv -f utf-8 -t utf-8 frontend/css/styles.css > /dev/null && echo OK
```

목표:
- `var(--mk-)` 사용 ≥ 50건/파일
- hardcoded 색 ≤ 10건/파일 (그라데이션/그림자 RGB는 예외)
- font-size hardcoded ≤ 5건/파일

---

## 6. D3 예고 (HTML 시맨틱 + ARIA)

D2 완료 후 D3 라운드:
- 5 HTML의 `<div>` 남용 → `<nav>/<main>/<section>/<article>/<aside>` 시맨틱 태그 전환
- 모든 인터랙티브 요소에 ARIA labels 추가 (현재 일부만 있음)
- 키보드 네비게이션 검증 (Tab 순서)
- 스킵 링크 (`mk-skip-link` 클래스 이미 정의됨) 5 페이지에 일괄 추가
- 이미지 alt 보강 (장식용은 `alt=""` + `aria-hidden="true"`)
- 폼 label-input 명시적 연결 (`for`/`id`)

---

## 7. 다음 라운드 매트릭스

| 우선 | 작업 | 라운드 |
|------|------|--------|
| 🔥 | D2-A (styles.css 마이그레이션) | R9 |
| 🔥 | D2-B (all-services-styles.css) | R9 |
| ⭐ | D2-C (intro-styles.css) | R10 |
| ⭐ | D2-D (service-detail-styles.css 잔여) | R10 |
| ✓ | D3 (HTML 시맨틱+ARIA) | R11 |
| ✓ | D4 (이미지·폰트 lazy load + critical CSS) | R12 |
