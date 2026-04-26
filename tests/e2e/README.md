# MaKIT E2E Tests (Playwright)

Comprehensive end-to-end test suite for MaKIT platform using Playwright and TypeScript.

## Quick Start

### Prerequisites

- Node.js 18+ and npm (or yarn)
- MaKIT backend running on `localhost:8080` (or `MAKIT_BASE_URL` env var)
- PostgreSQL 14+ running (for demo user seed data)
- Optional: AWS Bedrock keys for real AI integration (gracefully falls back to stub)

### Installation

```bash
# From project root
npm install @playwright/test --save-dev
npx playwright install chromium firefox webkit

# Verify installation
npx playwright --version
```

### Running Tests

```bash
# All tests (default: chromium)
npm run test:e2e

# Specific browser
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-chrome

# Specific test file
npm run test:e2e -- auth.spec.ts

# Watch mode (re-run on file change)
npm run test:e2e -- --watch

# With custom base URL
MAKIT_BASE_URL=https://staging.makit.com npm run test:e2e

# Debug mode (opens browser)
npm run test:e2e -- --debug

# UI mode (interactive)
npm run test:e2e -- --ui
```

### Viewing Results

```bash
# After tests run, view HTML report
npx playwright show-report

# This opens the Playwright Inspector showing:
# - Test execution timeline
# - Screenshots (on failure)
# - Network logs
# - Console logs
# - Video recordings (optional)
```

## Test Structure

```
tests/e2e/
├── auth.spec.ts           # J1: Register, login, logout (6 tests)
├── service.spec.ts        # J2: Service execution + history (3 tests) [TODO]
├── marketing-hub.spec.ts  # J3: Campaign CRUD + notifications (4 tests) [TODO]
├── notifications.spec.ts  # J4: Notification panel + WebSocket (3 tests) [TODO]
├── settings.spec.ts       # J5: Profile, theme, push settings (4 tests) [TODO]
├── pwa.spec.ts            # J6: PWA install + offline cache (3 tests) [TODO]
├── boundary.spec.ts       # B1-B5: Boundary & resilience tests (5 tests) [TODO]
└── README.md              # This file
```

## Test Scenarios

Each spec file corresponds to a **User Journey (J)** or **Boundary Test (B)** from the scenario document:

| ID | Name | Status | Coverage |
|----|------|--------|----------|
| J1 | Auth (register/login/logout) | DONE | 6 tests |
| J2 | Service Execution | TODO | 3 tests |
| J3 | Marketing Hub | TODO | 4 tests |
| J4 | Notifications | TODO | 3 tests |
| J5 | Settings | TODO | 4 tests |
| J6 | PWA Install | TODO | 3 tests |
| B1 | WebSocket Resilience | TODO | 1 test |
| B2 | Service Worker Cache | TODO | 1 test |
| B3 | Rate Limit 429 | TODO | 1 test |
| B4 | Bedrock Fallback | TODO | 1 test |
| B5 | Database Graceful Degrade | TODO | 1 test |

## Demo User & Test Data

### Built-in Demo Account
```
Email:    demo@makit.local
Password: Demo!1234
Name:     Demo User
```

This account is seeded via `DemoUserSeeder.java` at backend startup.

### Dynamic Test User Creation
E2E tests create unique users per run using timestamp:
```typescript
const ts = Date.now();
const testUser = {
  email: `e2e+${ts}@makit-test.local`,
  name: `E2E Test ${ts}`,
  password: `E2eTest!${ts % 10000}`
};
```

### Database Reset (Optional)
If needed, clean up test users before test run:
```sql
-- From psql
DELETE FROM audit_logs WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE 'e2e+%@makit-test.local'
);
DELETE FROM users WHERE email LIKE 'e2e+%@makit-test.local';
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAKIT_BASE_URL` | `http://localhost:8080` | Backend API base URL |
| `CI` | (unset) | Auto-detected in CI; enables retries |
| `DEBUG` | (unset) | Set to `pw:api` for Playwright debug logs |

Example:
```bash
MAKIT_BASE_URL=https://staging.makit.com npm run test:e2e
```

## Selectors & Accessibility

Tests use real element IDs from production HTML:

| Element | Selector | File |
|---------|----------|------|
| Login email input | `#loginEmail` | login.html |
| Register name input | `#regName` | login.html |
| Register button | `#regBtn` | login.html |
| Dashboard hero | `.hero-section` | index.html |
| Services grid | `.services-section` | index.html |
| Settings form | `#profileForm` | settings.html |

Accessibility checks:
- Skip link: `a.mk-skip-link` on every page
- ARIA labels on all interactive elements
- Keyboard navigation (Tab/Shift+Tab)
- Screen reader announcements via `role="status"` + `aria-live`

## Performance Benchmarks

Tests include optional performance assertions:

```typescript
// Example in future tests
const paintTiming = await page.evaluate(() => {
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return fcp?.startTime;
});
expect(paintTiming).toBeLessThan(1500); // < 1.5s FCP
```

Targets:
- LCP < 2.5s
- FCP < 1.5s
- CLS < 0.1
- TTI < 4s
- Skeleton visibility < 100ms

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install @playwright/test
      - run: npx playwright install chromium
      - run: npm start &  # Start backend
      - run: npm run test:e2e -- --project=chromium --workers=1
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests hang on navigation
- Ensure `page.waitForURL()` timeout is adequate (default 5s, increase to 10s for slow networks)
- Check backend is running: `curl http://localhost:8080/api/auth/me`

### "Service worker not found" (404 sw.js)
- Only affects PWA tests on `https://` or `localhost`
- On regular HTTP remote hosts, SW registration fails (expected)
- Backend should serve `frontend/sw.js` via static middleware

### Web Push permission dialog blocks test
- On headless Chromium, grant permission automatically:
  ```typescript
  context = await browser.newContext({
    permissions: ['notifications']
  });
  ```
- Add to future specs as needed

### Bedrock timeout in CI
- Set generous timeout (10s) or mock Bedrock responses
- Ensure AWS credentials/region env vars are set if testing real Bedrock
- Tests should gracefully fall back to stub (expected behavior)

### Chromium fails to launch
```bash
# On some systems, need to install deps
sudo apt-get install libxss1 libappindicator1 libindicator7

# Or use skip system check
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0 npx playwright install
```

## Extending Tests

### Adding a new spec file

1. Create `tests/e2e/new-feature.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MAKIT_BASE_URL || 'http://localhost:8080';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-login if needed
    await loginAsDemo(page);
  });

  test('user can do new feature', async ({ page }) => {
    // Arrange, Act, Assert
  });
});

// Helper function (shared across specs)
async function loginAsDemo(page) {
  await page.goto(BASE_URL + '/login.html');
  await page.fill('#loginEmail', 'demo@makit.local');
  await page.fill('#loginPassword', 'Demo!1234');
  await page.click('#loginBtn');
  await page.waitForURL(/index\.html/);
}
```

2. Run tests:
```bash
npm run test:e2e -- new-feature.spec.ts
```

### Adding accessibility checks

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('page is accessible', async ({ page }) => {
  await page.goto(BASE_URL + '/index.html');
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    }
  });
});
```

(Requires: `npm install axe-playwright`)

## Links & Resources

- **Scenario Document:** `_workspace/06_qa_r15d_e2e_scenarios.md`
- **Playwright Docs:** https://playwright.dev
- **Browser DevTools:** Integrated in `--debug` mode
- **Backend API Docs:** http://localhost:8080/api/swagger-ui.html
- **Frontend Build:** `cd frontend && npm run build` (optional, currently static)

---

**Last Updated:** 2026-04-26  
**Playwright Version:** 1.40+  
**Node Version:** 18.x+
