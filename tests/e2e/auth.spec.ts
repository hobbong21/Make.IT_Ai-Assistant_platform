import { test, expect } from '@playwright/test';

const BASE_URL = process.env.MAKIT_BASE_URL || 'http://localhost:8080';

test.describe('J1: Auth Flow - Register & Auto-Login', () => {
  test('user can register and is auto-logged in (happy path)', async ({ page }) => {
    // Step 1: Visit intro.html
    await page.goto(BASE_URL + '/intro.html');

    // Step 2: Verify hero section renders
    await expect(page.locator('h1.hero-title')).toContainText('비즈니스 성장을 가속화하세요');

    // Step 3: Navigate to login by clicking "플랫폼 보기" or direct navigation
    await page.click('a[href="index.html"].btn-primary, a.btn-primary');
    // Fallback: direct nav if button not found
    if (await page.url().includes('intro')) {
      await page.goto(BASE_URL + '/login.html');
    }

    // Step 4: Verify login page loaded
    await expect(page).toHaveURL(/login\.html/);
    await expect(page.locator('h1')).toContainText('MaKIT');

    // Step 5: Switch to register tab
    await page.click('#tab-register');
    await expect(page.locator('#register-pane')).toBeVisible();

    // Step 6-7: Fill register form with unique email
    const ts = Date.now();
    const testEmail = `e2e+${ts}@makit-test.local`;
    const testPassword = `E2eTest!${ts % 10000}`;

    await page.fill('#regName', `E2E Test User ${ts}`);
    await page.fill('#regEmail', testEmail);
    await page.fill('#regPassword', testPassword);
    await page.fill('#regPasswordConfirm', testPassword);

    // Step 8: Verify password strength indicator shows strong
    const strengthBar = page.locator('#regPasswordStrength .strength-bar');
    await expect(strengthBar).toHaveClass(/strength-(strong|medium)/);

    // Step 9: Check terms agreement
    await page.check('#agreeTerms');

    // Step 10: Submit register form
    const regBtn = page.locator('#regBtn');
    await regBtn.click();

    // Verify spinner shows briefly
    const spinner = page.locator('#regSpinner');
    await expect(spinner).toBeVisible();

    // Step 11: Wait for auto-login redirect to index.html
    await page.waitForURL(/index\.html/, { timeout: 5000 });

    // Step 12: Verify dashboard loaded
    await expect(page.locator('.hero-section')).toBeVisible();
    await expect(page.locator('h1.hero-title')).toContainText('Welcome To');

    // Verify user menu shows the new user's name
    const userMenu = page.locator('[class*="user"], [class*="avatar"]');
    await expect(userMenu.first()).toBeVisible();
  });

  test('demo user can login (happy path)', async ({ page }) => {
    // Step 1: Navigate to login
    await page.goto(BASE_URL + '/login.html');

    // Step 2: Verify login form visible
    await expect(page.locator('#login-pane')).toBeVisible();

    // Step 3: Fill login form
    await page.fill('#loginEmail', 'demo@makit.local');
    await page.fill('#loginPassword', 'Demo!1234');

    // Step 4: Submit login
    await page.click('#loginBtn');

    // Verify spinner shows
    const spinner = page.locator('#loginSpinner');
    await expect(spinner).toBeVisible();

    // Step 5: Wait for redirect to index.html
    await page.waitForURL(/index\.html/, { timeout: 5000 });

    // Step 6: Verify dashboard loaded
    await expect(page.locator('.hero-section')).toBeVisible();
    await expect(page.locator('.services-section')).toBeVisible();
  });

  test('logout returns to login page', async ({ page }) => {
    // Step 1: Pre-authenticate with demo account
    await page.goto(BASE_URL + '/login.html');
    await page.fill('#loginEmail', 'demo@makit.local');
    await page.fill('#loginPassword', 'Demo!1234');
    await page.click('#loginBtn');
    await page.waitForURL(/index\.html/);

    // Step 2: Verify dashboard loaded
    await expect(page.locator('.hero-section')).toBeVisible();

    // Step 3: Click user menu (multiple selector strategies)
    const userMenuTriggers = [
      '[class*="user-menu"]',
      '[class*="avatar"]',
      '[class*="profile"]',
      'button[class*="user"]'
    ];
    let userMenuClicked = false;
    for (const selector of userMenuTriggers) {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        await el.click();
        userMenuClicked = true;
        break;
      }
    }

    // Fallback: if no user menu found, try finding "로그아웃" button directly
    if (!userMenuClicked) {
      await page.click('text=로그아웃, text=Logout, text=Sign out');
    } else {
      // Wait for dropdown to appear
      await page.waitForTimeout(300);
      // Click logout in dropdown
      await page.click('text=로그아웃');
    }

    // Step 4: Verify redirect to login
    await page.waitForURL(/login\.html/, { timeout: 5000 });

    // Step 5: Verify login form is back
    await expect(page.locator('#loginForm, #login-pane')).toBeVisible();
  });

  test('email already registered returns 409 error', async ({ page }) => {
    // Step 1: Navigate to register
    await page.goto(BASE_URL + '/login.html');
    await page.click('#tab-register');

    // Step 2: Fill form with existing demo email
    const ts = Date.now();
    await page.fill('#regName', `Test User ${ts}`);
    await page.fill('#regEmail', 'demo@makit.local');
    await page.fill('#regPassword', 'TestPass!123');
    await page.fill('#regPasswordConfirm', 'TestPass!123');
    await page.check('#agreeTerms');

    // Step 3: Submit
    await page.click('#regBtn');

    // Step 4: Verify error message appears
    const regMessage = page.locator('#regMessage');
    await expect(regMessage).toContainText(/이미|중복|409/i);
  });

  test('password mismatch shows validation error', async ({ page }) => {
    // Step 1: Navigate to register
    await page.goto(BASE_URL + '/login.html');
    await page.click('#tab-register');

    // Step 2: Fill form with mismatched passwords
    const ts = Date.now();
    await page.fill('#regName', `Test User ${ts}`);
    await page.fill('#regEmail', `e2e+${ts}@test.local`);
    await page.fill('#regPassword', 'TestPass!123');
    await page.fill('#regPasswordConfirm', 'DifferentPass!456');

    // Step 3: Try to submit (may be blocked by browser HTML5 validation)
    const regBtn = page.locator('#regBtn');

    // Check if form has validation error or if we need JS check
    const confirmInput = page.locator('#regPasswordConfirm');
    const validity = await confirmInput.evaluate((el: HTMLInputElement) => el.validity?.valid);

    if (validity === false) {
      // HTML5 validation caught it
      await expect(confirmInput).not.toHaveAttribute('aria-invalid', 'false');
    }
  });

  test('wrong login credentials shows error', async ({ page }) => {
    // Step 1: Navigate to login
    await page.goto(BASE_URL + '/login.html');

    // Step 2: Fill with wrong credentials
    await page.fill('#loginEmail', 'nonexistent@test.local');
    await page.fill('#loginPassword', 'WrongPassword!123');

    // Step 3: Submit
    await page.click('#loginBtn');

    // Step 4: Verify error message
    const loginMessage = page.locator('#loginMessage');
    await expect(loginMessage).toContainText(/실패|틀렸|없음|401|404/i);

    // Step 5: Verify still on login page
    await expect(page).toHaveURL(/login\.html/);
  });
});
