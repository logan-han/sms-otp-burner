// @ts-check
const { test, expect } = require('@playwright/test');

const futureDate = () => new Date(Date.now() + 86400000).toISOString();

const mockApi = async (page, { numbers = [], messages = [] } = {}) => {
  await page.route('**/api/virtual-numbers', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ virtualNumbers: numbers, maxCount: 1 }),
    })
  );
  await page.route('**/api/messages', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    })
  );
};

const defaultNumber = { virtualNumber: '+61412345678', expiryDate: futureDate() };

const otpMessage = {
  id: 'm1',
  from: 'GitHub',
  to: '+61412345678',
  body: 'GitHub verification code: 044-921',
  receivedAt: new Date().toISOString(),
};

test.describe('SMS OTP Burner UI', () => {
  test.describe('Page Load', () => {
    test('displays the app header with title and subtitle', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page.locator('h1')).toContainText('burner/sms');
      await expect(page.locator('.subtitle')).toContainText('Disposable SMS for OTP verification');
    });

    test('reaches main content after loading', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
    });

    test('has the SMS OTP page title', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page).toHaveTitle(/SMS OTP/i);
    });
  });

  test.describe('Virtual Numbers Display', () => {
    test('renders the numbers strip with the leased number', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page.locator('.numbers-strip')).toBeVisible();
      await expect(page.getByRole('tab', { name: /\+61 412 345 678/ })).toBeVisible();
    });

    test('copy icon for a leased number switches to copied state', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'Clipboard permission not auto-granted on webkit');
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      const copyIcon = page.getByTitle('Copy number').first();
      await expect(copyIcon).toBeVisible();
      await copyIcon.click();

      // Component renders the IconCheck once the entry is in copied state.
      await expect(copyIcon.locator('svg path')).toHaveAttribute('d', /M4 12.5/, { timeout: 2000 });
    });
  });

  test.describe('Messages Section', () => {
    test('shows the inbox toolbar', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page.locator('.toolbar')).toBeVisible();
      await expect(page.locator('.toolbar-title')).toContainText('Inbox');
    });

    test('refresh button reads "check for new"', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      const refreshBtn = page.locator('.refresh-btn');
      await expect(refreshBtn).toBeVisible();
      await expect(refreshBtn).toContainText('check for new');
    });

    test('shows empty state when no messages', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      await expect(page.locator('.no-messages')).toBeVisible();
      await expect(page.locator('.no-messages')).toContainText(/Inbox empty/i);
    });

    test('message rows show sender, message, and recipient', async ({ page }) => {
      const message = {
        to: '+61412345678',
        from: '+61498765432',
        body: 'Your OTP is 123456',
        receivedAt: new Date().toISOString(),
      };
      await mockApi(page, { numbers: [defaultNumber], messages: [message] });

      await page.goto('/');

      const messageRow = page.locator('.message-row').first();
      await expect(messageRow).toBeVisible();
      await expect(messageRow.locator('.card-from-name')).toContainText(message.from);
      await expect(messageRow.locator('.message-cell')).toContainText(message.body);
      await expect(messageRow.locator('.card-to')).toContainText('to +61 412 345 678');
    });
  });

  test.describe('OTP detection', () => {
    test('renders the detected OTP as a copy button on the card', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber], messages: [otpMessage] });

      await page.goto('/');

      const otpButton = page.locator('.card-otp').first();
      await expect(otpButton).toBeVisible();
      await expect(otpButton).toContainText('044921');
    });

    test('opens the modal with the OTP hero when card is clicked', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber], messages: [otpMessage] });

      await page.goto('/');

      await page.locator('.message-row').first().click();
      const modal = page.locator('.modal');
      await expect(modal).toBeVisible();
      await expect(modal.locator('.otp-hero-label')).toContainText(/detected one-time code/i);
    });

    test('Escape closes the modal', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber], messages: [otpMessage] });

      await page.goto('/');

      await page.locator('.message-row').first().click();
      await expect(page.locator('.modal')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.locator('.modal')).toBeHidden();
    });
  });

  test.describe('Error Handling', () => {
    test('renders error banner when API fails', async ({ page }) => {
      await page.route('**/api/virtual-numbers', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        })
      );

      await page.goto('/');

      await expect(page.locator('.error-banner')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.error-icon')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('renders on mobile viewport', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.app-header')).toBeVisible();
    });

    test('renders on tablet viewport', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('refresh button is keyboard focusable when enabled', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      const refreshBtn = page.locator('.refresh-btn');
      await expect(refreshBtn).toBeEnabled();
      await refreshBtn.focus();
      await expect(refreshBtn).toBeFocused();
    });

    test('exposes a single h1 page heading', async ({ page }) => {
      await mockApi(page, { numbers: [defaultNumber] });
      await page.goto('/');

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('burner/sms');
    });
  });

  test.describe('API Integration', () => {
    test('calls the virtual-numbers endpoint on load', async ({ page }) => {
      let apiCalled = false;

      await page.route('**/api/virtual-numbers', (route) => {
        apiCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ virtualNumbers: [defaultNumber], maxCount: 1 }),
        });
      });
      await page.route('**/api/messages', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
      );

      await page.goto('/');
      await expect(page.locator('.main-content')).toBeVisible();
      expect(apiCalled).toBeTruthy();
    });

    test('refresh button triggers a fresh /api/messages call', async ({ page }) => {
      let messagesCalled = 0;
      await page.route('**/api/virtual-numbers', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ virtualNumbers: [defaultNumber], maxCount: 1 }),
        })
      );
      await page.route('**/api/messages', (route) => {
        messagesCalled += 1;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
      });

      await page.goto('/');
      await expect(page.locator('.refresh-btn')).toBeEnabled();

      const before = messagesCalled;
      await page.click('.refresh-btn');
      await expect.poll(() => messagesCalled).toBeGreaterThan(before);
    });
  });

  test.describe('Search filter', () => {
    test('filters messages by search query', async ({ page }) => {
      await mockApi(page, {
        numbers: [defaultNumber],
        messages: [
          { id: 'a', from: 'GitHub', to: '+61412345678', body: 'GitHub code 111222', receivedAt: new Date().toISOString() },
          { id: 'b', from: 'Stripe', to: '+61412345678', body: 'Stripe code 333444', receivedAt: new Date().toISOString() },
        ],
      });

      await page.goto('/');

      await expect(page.locator('.message-cell')).toHaveCount(2);

      await page.locator('.search input').fill('Stripe');
      await expect(page.locator('.message-cell')).toHaveCount(1);
      await expect(page.locator('.message-cell').first()).toContainText('Stripe code 333444');
    });
  });
});
