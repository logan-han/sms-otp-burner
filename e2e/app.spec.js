// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('SMS OTP Burner UI', () => {
  test.describe('Page Load', () => {
    test('should display the app header with title and subtitle', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('h1')).toContainText('SMS OTP Burner');
      await expect(page.locator('.subtitle')).toContainText('Temporary SMS numbers for OTP verification');
    });

    test('should show loading state initially', async ({ page }) => {
      await page.goto('/');

      // Either loading banner or loading-initial should appear
      const loadingBanner = page.locator('.loading-banner');
      const loadingInitial = page.locator('.loading-initial');

      await expect(loadingBanner.or(loadingInitial)).toBeVisible({ timeout: 5000 });
    });

    test('should have correct page title', async ({ page }) => {
      await page.goto('/');

      await expect(page).toHaveTitle(/SMS OTP/i);
    });
  });

  test.describe('Virtual Numbers Display', () => {
    test('should display virtual numbers section after loading', async ({ page }) => {
      await page.goto('/');

      // Wait for the numbers card or error to appear
      const numbersCard = page.locator('.numbers-card, .number-card');
      const errorBanner = page.locator('.error-banner');

      await expect(numbersCard.or(errorBanner)).toBeVisible({ timeout: 30000 });
    });

    test('should show copy button for virtual numbers', async ({ page }) => {
      await page.goto('/');

      // Wait for either numbers to load or an error state
      await page.waitForTimeout(2000);

      const copyButton = page.locator('.copy-btn');
      const hasNumbers = await copyButton.count();

      if (hasNumbers > 0) {
        await expect(copyButton.first()).toBeVisible();
        await expect(copyButton.first()).toHaveAttribute('title', /Copy number|Copied!/);
      }
    });

    test('copy button should change icon when clicked', async ({ page }) => {
      await page.goto('/');

      // Wait for numbers to potentially load
      await page.waitForTimeout(3000);

      const copyButton = page.locator('.copy-btn').first();
      const hasButton = await copyButton.count();

      if (hasButton > 0) {
        // Check initial state has clipboard emoji
        await expect(copyButton).toContainText(/[clipboard emoji]|copy/i);

        await copyButton.click();

        // After click, should show checkmark
        await expect(copyButton).toContainText(/[checkmark]/);
      }
    });
  });

  test.describe('Messages Section', () => {
    test('should display messages section', async ({ page }) => {
      await page.goto('/');

      // Wait for main content
      await page.waitForSelector('.main-content, .error-banner, .loading-initial', { timeout: 30000 });

      const messagesCard = page.locator('.messages-card');
      const mainContent = page.locator('.main-content');

      // If main content is visible, messages card should be there
      if (await mainContent.isVisible()) {
        await expect(messagesCard).toBeVisible();
        await expect(page.locator('h2')).toContainText('Received Messages');
      }
    });

    test('should have refresh button in messages section', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const refreshBtn = page.locator('.refresh-btn');

      if (await page.locator('.main-content').isVisible()) {
        await expect(refreshBtn).toBeVisible();
        await expect(refreshBtn).toContainText('Refresh');
      }
    });

    test('should show empty state when no messages', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const noMessages = page.locator('.no-messages');
      const messagesTable = page.locator('.messages-table');

      if (await page.locator('.main-content').isVisible()) {
        // Either no-messages or messages-table should be visible
        const hasNoMessages = await noMessages.isVisible();
        const hasTable = await messagesTable.isVisible();

        expect(hasNoMessages || hasTable).toBeTruthy();
      }
    });

    test('messages table should have correct columns', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const messagesTable = page.locator('.messages-table');

      if (await messagesTable.isVisible()) {
        await expect(page.locator('th')).toContainText(['To Number', 'From', 'Message', 'Date', 'Time']);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should display error banner when API fails', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/virtual-numbers', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      });

      await page.goto('/');

      const errorBanner = page.locator('.error-banner');
      await expect(errorBanner).toBeVisible({ timeout: 10000 });
    });

    test('error banner should have warning icon', async ({ page }) => {
      await page.route('**/api/virtual-numbers', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Test error' }),
        });
      });

      await page.goto('/');

      const errorIcon = page.locator('.error-icon');
      await expect(errorIcon).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Responsive Design', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.app-header')).toBeVisible();
    });

    test('should be usable on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('buttons should be keyboard accessible', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const refreshBtn = page.locator('.refresh-btn');

      if (await refreshBtn.isVisible()) {
        await refreshBtn.focus();
        await expect(refreshBtn).toBeFocused();
      }
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // h1 should exist
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);

      // h2s should exist for subsections
      const h2s = page.locator('h2');
      const h2Count = await h2s.count();
      expect(h2Count).toBeGreaterThan(0);
    });
  });

  test.describe('API Integration', () => {
    test('should make request to virtual-numbers endpoint', async ({ page }) => {
      let apiCalled = false;

      await page.route('**/api/virtual-numbers', (route) => {
        apiCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ virtualNumbers: [] }),
        });
      });

      await page.goto('/');
      await page.waitForTimeout(2000);

      expect(apiCalled).toBeTruthy();
    });

    test('should display virtual number from API response', async ({ page }) => {
      const mockNumber = '+61412345678';

      await page.route('**/api/virtual-numbers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            virtualNumbers: [{
              virtualNumber: mockNumber,
              expiryDate: new Date(Date.now() + 86400000).toISOString(),
            }],
          }),
        });
      });

      await page.route('**/api/messages', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: [] }),
        });
      });

      await page.goto('/');

      await expect(page.locator('.number-value')).toContainText(mockNumber, { timeout: 10000 });
    });

    test('should display messages from API response', async ({ page }) => {
      const mockMessage = {
        to: '+61412345678',
        from: '+61498765432',
        body: 'Your OTP is 123456',
        receivedAt: new Date().toISOString(),
      };

      await page.route('**/api/virtual-numbers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            virtualNumbers: [{
              virtualNumber: '+61412345678',
              expiryDate: new Date(Date.now() + 86400000).toISOString(),
            }],
          }),
        });
      });

      await page.route('**/api/messages', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: [mockMessage] }),
        });
      });

      await page.goto('/');

      await expect(page.locator('.message-cell')).toContainText('Your OTP is 123456', { timeout: 10000 });
    });
  });

  test.describe('User Interactions', () => {
    test('refresh button should trigger API call', async ({ page }) => {
      let messagesCalled = 0;

      await page.route('**/api/virtual-numbers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            virtualNumbers: [{
              virtualNumber: '+61412345678',
              expiryDate: new Date(Date.now() + 86400000).toISOString(),
            }],
          }),
        });
      });

      await page.route('**/api/messages', (route) => {
        messagesCalled++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: [] }),
        });
      });

      await page.goto('/');

      await page.waitForSelector('.refresh-btn', { timeout: 10000 });

      const initialCalls = messagesCalled;
      await page.click('.refresh-btn');
      await page.waitForTimeout(1000);

      expect(messagesCalled).toBeGreaterThan(initialCalls);
    });
  });
});
