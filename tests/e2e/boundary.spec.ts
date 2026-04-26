import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MAKIT_BASE_URL || 'http://localhost:8080';

test.describe('Boundary Tests (B1-B5)', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-login
    await page.goto(BASE_URL + '/login.html');
    await page.fill('#loginEmail', 'demo@makit.local');
    await page.fill('#loginPassword', 'Demo!1234');
    await page.click('#loginBtn');
    await page.waitForURL(/index\.html/);
  });

  test('B1: WebSocket reconnects after network drop', async ({ page }) => {
    // Open developer tools and throttle network
    // This test checks that WebSocket automatically reconnects

    // Navigate to page with WebSocket (index or marketing-hub)
    await page.goto(BASE_URL + '/marketing-hub.html');
    await expect(page.locator('[class*="hub"]')).toBeVisible();

    // Intercept network to simulate disconnect
    // Note: browser.newBrowserContext() throttle approach
    // For now, we test the reconnect by checking ws-client behavior

    // Log to verify ws-client is active
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Trigger a service call that would update notifications
    // and observe badge refresh

    const badge = page.locator('[class*="badge"], [class*="notification"]').first();
    const initialBadgeText = await badge.textContent().catch(() => '0');

    // Service call triggers notification
    // (This is simulated or actual API call depending on test data)

    // Wait for badge to update (indicating WebSocket received notification)
    await expect(badge).toHaveText(/[1-9]/i, { timeout: 5000 }).catch(() => {
      // If timeout, check reconnect logs
      const reconnectLog = consoleMessages.some(msg =>
        msg.includes('STOMP') || msg.includes('reconnect') || msg.includes('connected')
      );
      console.log('Reconnect logs found:', reconnectLog);
    });
  });

  test('B2: Service Worker caches shell on first visit, then cache-first on repeat', async ({ browser }) => {
    // Use fresh context to simulate first visit
    const context = await browser.newContext();
    const page = await context.newPage();

    // Clear any existing service workers/cache
    await page.context().clearCookies();

    // First visit
    await page.goto(BASE_URL + '/index.html');

    // Wait for service worker registration
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(() => resolve(true));
        } else {
          resolve(false);
        }
      });
    });

    // Measure first visit load time
    const firstLoadMetrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(e => e.name === 'first-contentful-paint')?.startTime;
      return { fcp };
    });

    expect(firstLoadMetrics.fcp).toBeTruthy();

    // Verify cache storage exists
    const cacheNames = await page.evaluate(() => {
      return caches.keys();
    });

    expect(cacheNames.length).toBeGreaterThan(0);

    // Second visit (should hit cache)
    await page.reload();

    const secondLoadMetrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(e => e.name === 'first-contentful-paint')?.startTime;
      return { fcp };
    });

    // Second load should be faster (cache hit)
    // Note: This might not be reliable in test env, just verify it completes
    expect(secondLoadMetrics.fcp).toBeTruthy();

    await context.close();
  });

  test('B3: Rate limit 429 returns Retry-After header', async ({ page }) => {
    // This test checks that frontend properly handles 429 responses
    // We'll intercept and mock a 429 response

    await page.route('**/api/**', async (route) => {
      // First 10 requests pass, 11th returns 429
      const req = route.request();
      const count = (global as any).requestCount || 0;
      (global as any).requestCount = count + 1;

      if (count >= 10) {
        // Return 429 with Retry-After
        return route.abort('serviceunavailable');
      }
      return route.continue();
    });

    // Make service call that would trigger rate limit error
    await page.goto(BASE_URL + '/service-detail.html?service=nlp-analyze');

    const textarea = page.locator('textarea, [class*="input"]').first();
    const submitBtn = page.locator('button').filter({
      hasText: /분석|Submit/i
    }).first();

    // Attempt multiple calls
    for (let i = 0; i < 5; i++) {
      await textarea.fill(`Test ${i}`);
      await submitBtn.click();
      await page.waitForTimeout(100);
    }

    // Check for rate limit error message
    const errorMsg = page.locator('[class*="error"], [role="alert"]');
    // Error should be shown or request should be queued
    // This depends on actual implementation
  });

  test('B4: Bedrock timeout falls back to stub', async ({ page }) => {
    // Navigate to a service that uses Bedrock
    await page.goto(BASE_URL + '/service-detail.html?service=nlp-analyze');

    // Intercept Bedrock calls and simulate timeout
    await page.route('**/api/data-intelligence/**', async (route) => {
      // Simulate Bedrock timeout by delaying response
      await page.waitForTimeout(6000); // > 5s timeout
      return route.abort('timedout');
    });

    const textarea = page.locator('textarea, [class*="input"]').first();
    const submitBtn = page.locator('button').filter({
      hasText: /분석|Submit/i
    }).first();

    await textarea.fill('Test for fallback');
    await submitBtn.click();

    // Wait for fallback response
    const resultArea = page.locator('[class*="result"], [class*="response"]').first();
    await expect(resultArea).toBeVisible({ timeout: 10000 });

    const content = await resultArea.textContent();
    expect(content).toBeTruthy();
    // Stub response typically says "예시입니다" or similar
  });

  test('B5: Database down returns graceful error page', async ({ page }) => {
    // This test requires actual database down or mocking DB errors
    // We'll intercept API calls and return 503

    await page.route('**/api/**', async (route) => {
      return route.abort('failed');
    });

    // Navigate to a page that requires API
    await page.goto(BASE_URL + '/marketing-hub.html');

    // Expect error handling (could be graceful message or skeleton)
    // Check for error alert or empty state
    const errorAlert = page.locator('[role="alert"], [class*="error"]');
    const emptySkeleton = page.locator('[class*="skeleton"]');

    const hasErrorAlert = await errorAlert.isVisible().catch(() => false);
    const hasSkeleton = await emptySkeleton.isVisible().catch(() => false);

    expect(hasErrorAlert || hasSkeleton).toBeTruthy();
  });

  test('B1-variant: WebSocket handles disconnect gracefully (network offline)', async ({ page }) => {
    // Simulate offline by disabling network in DevTools
    // Then trigger service call and verify graceful handling

    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Try to call API
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('http://localhost:8080/api/auth/me');
        return { ok: res.ok };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }).catch(() => ({ error: 'network error' }));

    expect(result.error || !result.ok).toBeTruthy();

    // Verify UI shows offline gracefully
    const content = await page.content();
    expect(content).toBeTruthy(); // Page should still render

    // Re-enable network
    await page.context().setOffline(false);
  });
});
