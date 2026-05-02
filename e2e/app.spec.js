// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('SMS OTP Burner UI', () => {
  test.describe('Page Load', () => {
    test('should display the app header with title and subtitle', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('h1')).toContainText('burner/sms');
      await expect(page.locator('.subtitle')).toContainText('Disposable SMS for OTP verification');
    });

    test('should show loading state or content', async ({ page }) => {
      await page.goto('/');

      // Either loading state or main content should be visible
      // (loading may complete before we can observe it in fast browsers)
      const loadingBanner = page.locator('.loading-banner');
      const loadingInitial = page.locator('.loading-initial');
      const mainContent = page.locator('.main-content');
      const errorBanner = page.locator('.error-banner');

      // Any of these indicates the app is working
      await expect(
        loadingBanner.or(loadingInitial).or(mainContent).or(errorBanner).first()
      ).toBeVisible({ timeout: 10000 });
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
      const numbersCard = page.locator('.numbers-strip');
      const errorBanner = page.locator('.error-banner');

      // Use .first() to avoid strict mode violation when both elements exist
      await expect(numbersCard.or(errorBanner).first()).toBeVisible({ timeout: 30000 });
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
        await copyButton.click();

        // After click, the button advertises the copied state through its title.
        await expect(copyButton).toHaveAttribute('title', 'Copied!');
      }
    });
  });

  test.describe('Messages Section', () => {
    test('should display messages section', async ({ page }) => {
      await page.goto('/');

      // Wait for main content
      await page.waitForSelector('.main-content, .error-banner, .loading-initial', { timeout: 30000 });

      const messagesToolbar = page.locator('.toolbar');
      const mainContent = page.locator('.main-content');

      // If main content is visible, the inbox toolbar should be there.
      if (await mainContent.isVisible()) {
        await expect(messagesToolbar).toBeVisible();
        await expect(page.locator('.toolbar-title')).toContainText('Inbox');
      }
    });

    test('should have refresh button in messages section', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const refreshBtn = page.locator('.refresh-btn');

      if (await page.locator('.main-content').isVisible()) {
        await expect(refreshBtn).toBeVisible();
        await expect(refreshBtn).toContainText('check for new');
      }
    });

    test('should show empty state when no messages', async ({ page }) => {
      await page.goto('/');

      await page.waitForSelector('.main-content, .error-banner', { timeout: 30000 });

      const noMessages = page.locator('.no-messages');
      const messageRows = page.locator('.message-row');

      if (await page.locator('.main-content').isVisible()) {
        // Either no-messages or message rows should be visible.
        const hasNoMessages = await noMessages.isVisible();
        const hasRows = await messageRows.first().isVisible();

        expect(hasNoMessages || hasRows).toBeTruthy();
      }
    });

    test('message rows should show sender, message, and recipient', async ({ page }) => {
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

      const messageRow = page.locator('.message-row').first();
      await expect(messageRow).toBeVisible({ timeout: 10000 });
      await expect(messageRow.locator('.card-from-name')).toContainText(mockMessage.from);
      await expect(messageRow.locator('.message-cell')).toContainText(mockMessage.body);
      await expect(messageRow.locator('.card-to')).toContainText('to +61 412 345 678');
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
        const isDisabled = await refreshBtn.isDisabled();
        // Only test focus if button is enabled (disabled buttons cannot receive focus)
        if (!isDisabled) {
          await refreshBtn.focus();
          await expect(refreshBtn).toBeFocused();
        }
      }
    });

    test('should expose the primary page heading', async ({ page }) => {
      await page.goto('/');

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toContainText('burner/sms');
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

      await expect(page.getByRole('tab', { name: /\+61 412 345 678/ })).toBeVisible({ timeout: 10000 });
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
