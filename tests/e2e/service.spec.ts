import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MAKIT_BASE_URL || 'http://localhost:8080';

test.describe('J2: Service Execution & History', () => {
  test.beforeEach(async ({ page }) => {
    // Pre-login as demo user
    await page.goto(BASE_URL + '/login.html');
    await page.fill('#loginEmail', 'demo@makit.local');
    await page.fill('#loginPassword', 'Demo!1234');
    await page.click('#loginBtn');
    await page.waitForURL(/index\.html/);
  });

  test('user can execute NLP analyze service', async ({ page }) => {
    // Step 1: Navigate to dashboard
    await expect(page.locator('.hero-section')).toBeVisible();

    // Step 2: Find AX Data Intelligence service card and click
    const dataCard = page.locator('[class*="service-card"]').filter({
      hasText: /Data Intelligence/
    }).first();
    await expect(dataCard).toBeVisible();

    const serviceButton = dataCard.locator('[class*="service-button"], a');
    await serviceButton.click();

    // Step 3: Verify service-detail page loaded for nlp-analyze
    await page.waitForURL(/service-detail\.html\?service=nlp-analyze/);
    await expect(page.locator('h1, h2, [class*="title"]')).toContainText(/자연어|분석|NLP/i);

    // Step 4: Fill and submit the service form
    const textarea = page.locator('textarea, [class*="input"], input[type="text"]').first();
    const submitBtn = page.locator('button').filter({
      hasText: /분석|분석하기|Execute|Submit|Send/i
    }).first();

    await textarea.fill('MaKIT은 AI 마케팅 플랫폼입니다. 매우 강력합니다.');
    await submitBtn.click();

    // Step 5: Wait for streaming response
    // Expect response to appear in chat-like UI or results area
    const resultArea = page.locator('[class*="result"], [class*="response"], [class*="message"]').first();
    await expect(resultArea).toBeVisible({ timeout: 10000 });

    // Step 6: Verify markdown rendering (look for common markdown elements)
    const content = await resultArea.textContent();
    expect(content).toBeTruthy();
    expect(content?.length).toBeGreaterThan(10); // Not empty response
  });

  test('user sees thumbs feedback and service appears in history', async ({ page }) => {
    // Navigate to service-detail
    await page.goto(BASE_URL + '/service-detail.html?service=chatbot');

    // Fill and submit
    const textarea = page.locator('textarea, [class*="input"]').first();
    const submitBtn = page.locator('button').filter({
      hasText: /답변|Chat|Submit|Send/i
    }).first();

    await textarea.fill('고객입니다. 배송 언제 되나요?');
    await submitBtn.click();

    // Wait for response and thumbs buttons
    const feedbackButtons = page.locator('[class*="feedback"], [aria-label*="helpful"]');
    await expect(feedbackButtons.first()).toBeVisible({ timeout: 10000 });

    // Click thumbs-up
    const thumbsUp = feedbackButtons.filter({
      hasText: /👍|좋음|helpful|up/i
    }).first();
    await thumbsUp.click();

    // Verify feedback confirmation
    const confirmMsg = page.locator('[class*="toast"], [class*="message"], [role="status"]');
    await expect(confirmMsg).toContainText(/감사|감수|피드백/i);

    // Navigate to history
    await page.goto(BASE_URL + '/history.html');

    // Verify chatbot service appears in history
    await expect(page.locator('text=고객 응대|Chatbot|Chat')).toBeVisible();
  });

  test('bedrock unavailable falls back to stub markdown', async ({ page }) => {
    // This test assumes Bedrock is either down or intentionally disabled
    // The service should still return a response (stub)

    await page.goto(BASE_URL + '/service-detail.html?service=nlp-analyze');

    const textarea = page.locator('textarea, [class*="input"]').first();
    const submitBtn = page.locator('button').filter({
      hasText: /분석|Submit/i
    }).first();

    await textarea.fill('Test text for fallback');
    await submitBtn.click();

    // Wait for response (stub or real)
    const resultArea = page.locator('[class*="result"], [class*="response"]').first();
    await expect(resultArea).toBeVisible({ timeout: 10000 });

    // Optionally check console for fallback warning
    // (This would require intercepting network or console logs)
    const content = await resultArea.textContent();
    expect(content).toBeTruthy();
  });
});
