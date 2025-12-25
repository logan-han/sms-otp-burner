describe('Handler Functions', () => {
  const originalEnv = process.env;
  let handler;

  // Mock fetch globally
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  const createFetchResponse = (data, ok = true, status = 200) => ({
    ok,
    status,
    json: () => Promise.resolve(data),
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();

    process.env = {
      ...originalEnv,
      TELSTRA_CLIENT_ID: 'test_client_id',
      TELSTRA_CLIENT_SECRET: 'test_client_secret',
      MAX_LEASED_NUMBER_COUNT: '1',
      ALLOWED_ORIGINS: 'http://localhost:3000,https://sms.han.life',
      DEBUG: 'false',
    };

    // Default: reject all requests (auth failure)
    mockFetch.mockRejectedValue(new Error('Network error'));

    handler = require('../../handler');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  // =====================
  // Basic export tests
  // =====================
  test('leaseNumber handler exists and exports correctly', () => {
    expect(typeof handler.leaseNumber).toBe('function');
  });

  test('releaseNumber handler exists and exports correctly', () => {
    expect(typeof handler.releaseNumber).toBe('function');
  });

  test('getAllVirtualNumbers handler exists and exports correctly', () => {
    expect(typeof handler.getAllVirtualNumbers).toBe('function');
  });

  test('getMessages handler exists and exports correctly', () => {
    expect(typeof handler.getMessages).toBe('function');
  });

  test('getAllMessages handler exists and exports correctly', () => {
    expect(typeof handler.getAllMessages).toBe('function');
  });

  test('serveFrontend handler exists and exports correctly', () => {
    expect(typeof handler.serveFrontend).toBe('function');
  });

  test('api handler exists and exports correctly', () => {
    expect(typeof handler.api).toBe('function');
  });

  test('getNumber handler exists and exports correctly', () => {
    expect(typeof handler.getNumber).toBe('function');
  });

  // =====================
  // Successful API flow tests
  // =====================
  describe('Successful API flows', () => {
    beforeEach(() => {
      jest.resetModules();
      mockFetch.mockReset();

      // Mock successful auth token followed by API calls
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      handler = require('../../handler');
    });

    test('leaseNumber successfully leases a new number when none exist', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options || options.method === 'GET' || !options.method)) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'POST') {
          return Promise.resolve(createFetchResponse({ virtualNumber: '+61412345678' }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Successfully leased');
      expect(body.virtualNumbers).toHaveLength(1);
      expect(body.virtualNumbers[0].virtualNumber).toBe('+61412345678');
    });

    test('leaseNumber returns existing numbers when max count is reached', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Already have');
      expect(body.leasedCount).toBe(1);
      expect(body.maxCount).toBe(1);
    });

    test('getNumber returns existing virtual numbers', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [
              { virtualNumber: '+61412345678' },
              { virtualNumber: '+61412345679' },
            ],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
    });

    test('getNumber returns 404 when no numbers exist', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('No active numbers leased');
    });

    test('getAllVirtualNumbers returns all virtual numbers', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [
              { virtualNumber: '+61412345678', expiryDate: '2025-12-31' },
              { virtualNumber: '+61412345679', expiryDate: '2025-12-31' },
            ],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
      expect(body.virtualNumbers[0].msisdn).toBe('+61412345678');
    });

    test('getAllVirtualNumbers returns empty array when no numbers exist', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });

    test('getMessages returns messages for active numbers', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('/messages')) {
          return Promise.resolve(createFetchResponse({
            messages: [
              {
                from: '+61987654321',
                messageContent: 'Your OTP is 123456',
                to: '+61412345678',
                receivedTimestamp: '2025-01-01T10:00:00Z',
              },
              {
                sourceNumber: '+61987654322',
                body: 'Another message',
                destinationNumber: '+61412345678',
                createTimestamp: '2025-01-01T09:00:00Z',
              },
            ],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.getMessages({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].body).toBe('Your OTP is 123456');
      expect(body.activeNumbers).toContain('+61412345678');
    });

    test('releaseNumber successfully releases a number', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'DELETE') {
          return Promise.resolve(createFetchResponse({}));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ number: '+61412345678' }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('released successfully');
    });

    test('releaseNumber handles 404 from Telstra (already released)', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'DELETE') {
          return Promise.resolve(createFetchResponse({ error: 'not_found' }, false, 404));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ virtualNumber: '+61412345678' }),
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('already released');
    });

    test('releaseNumber returns 400 when number does not match', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_access_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ number: '+61999999999' }),
      });

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('does not match');
    });
  });

  // =====================
  // Token caching tests
  // =====================
  describe('Token caching', () => {
    test('getTelstraAccessToken returns cached token if valid', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      let tokenCallCount = 0;
      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          tokenCallCount++;
          return Promise.resolve(createFetchResponse({
            access_token: `token_${tokenCallCount}`,
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        return Promise.reject(new Error('Unexpected request: ' + url));
      });

      handler = require('../../handler');

      // Make two API calls
      await handler.getNumber({ headers: {} });
      await handler.getNumber({ headers: {} });

      // Should only have requested token once due to caching
      expect(tokenCallCount).toBe(1);
    });
  });

  // =====================
  // Error handling tests
  // =====================
  describe('Error handling', () => {
    test('leaseNumber handles API error gracefully', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'POST') {
          return Promise.resolve(createFetchResponse({ error: 'bad_request' }, false, 400));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.leasedCount).toBe(0);
    });

    test('getMessages returns error when API fails', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers')) {
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('/messages')) {
          return Promise.resolve(createFetchResponse({ error: 'server_error' }, false, 500));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getMessages({ headers: {} });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to fetch messages');
    });

    test('getNumber returns 500 on API error', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        return Promise.reject(new Error('Network error'));
      });

      handler = require('../../handler');

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Failed to check for active numbers');
    });
  });

  // =====================
  // releaseNumber tests
  // =====================
  test('releaseNumber returns 400 when number is missing', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve(createFetchResponse({
          access_token: 'test_token',
          expires_in: 3600,
        }));
      }
      if (url.includes('virtual-numbers')) {
        return Promise.resolve(createFetchResponse({
          virtualNumbers: [{ virtualNumber: '+61412345678' }],
        }));
      }
      return Promise.reject(new Error('Unexpected'));
    });

    const result = await handler.releaseNumber({ headers: {}, body: JSON.stringify({}) });

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Missing virtual number to release');
  });

  test('getMessages returns 404 when no active subscription', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve(createFetchResponse({
          access_token: 'test_token',
          expires_in: 3600,
        }));
      }
      if (url.includes('virtual-numbers')) {
        return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
      }
      return Promise.reject(new Error('Unexpected'));
    });

    const result = await handler.getMessages({ headers: {} });

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No active numbers to fetch messages for');
  });

  test('releaseNumber handles malformed request body', async () => {
    const result = await handler.releaseNumber({ headers: {}, body: 'invalid json' });

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Invalid JSON in request body');
  });

  test('releaseNumber handles missing body', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve(createFetchResponse({
          access_token: 'test_token',
          expires_in: 3600,
        }));
      }
      if (url.includes('virtual-numbers')) {
        return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
      }
      return Promise.reject(new Error('Unexpected'));
    });

    const result = await handler.releaseNumber({ headers: {} });

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No active numbers found to release');
  });

  test('getAllMessages delegates to getMessages', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve(createFetchResponse({
          access_token: 'test_token',
          expires_in: 3600,
        }));
      }
      if (url.includes('virtual-numbers')) {
        return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
      }
      return Promise.reject(new Error('Unexpected'));
    });

    const result = await handler.getAllMessages({ headers: {} });

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No active numbers to fetch messages for');
  });

  // =====================
  // API routing tests
  // =====================
  test('api handles OPTIONS requests for CORS', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
      path: '/messages',
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  test('api returns correct CORS origin for allowed domain', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://sms.han.life' },
      path: '/messages',
    };

    const result = await handler.api(event);

    expect(result.headers['Access-Control-Allow-Origin']).toBe('https://sms.han.life');
  });

  test('api returns default CORS origin for unknown domain', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://evil.com' },
      path: '/messages',
    };

    const result = await handler.api(event);

    // Returns first allowed origin for unknown domains
    expect(result.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  test('api returns 404 for unknown routes', async () => {
    const event = {
      httpMethod: 'GET',
      headers: {},
      path: '/unknown',
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Route not found: GET /api/');
  });

  test('api routes POST /leaseNumber correctly', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('oauth/token')) {
        return Promise.resolve(createFetchResponse({
          access_token: 'test_token',
          expires_in: 3600,
        }));
      }
      if (url.includes('virtual-numbers')) {
        return Promise.resolve(createFetchResponse({
          virtualNumbers: [{ virtualNumber: '+61412345678' }],
        }));
      }
      return Promise.reject(new Error('Unexpected'));
    });

    const event = {
      httpMethod: 'POST',
      headers: {},
      pathParameters: { proxy: 'leaseNumber' },
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api returns 405 for unsupported method on leaseNumber', async () => {
    const event = {
      httpMethod: 'PUT',
      headers: {},
      pathParameters: { proxy: 'leaseNumber' },
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Method PUT not allowed');
    expect(body.allowedMethods).toContain('POST');
    expect(body.allowedMethods).toContain('DELETE');
  });

  test('api handles missing httpMethod', async () => {
    const event = {
      headers: {},
      path: '/messages',
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('HTTP method is required');
  });

  test('api includes security headers', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: {},
      path: '/messages',
    };

    const result = await handler.api(event);

    expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(result.headers['X-Frame-Options']).toBe('DENY');
    expect(result.headers['Strict-Transport-Security']).toContain('max-age=');
  });

  // =====================
  // serveFrontend tests
  // =====================
  test('serveFrontend serves index.html for root path', async () => {
    const event = { headers: {}, pathParameters: null };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      return filePath.includes('index.html');
    });

    jest.spyOn(fs, 'readFileSync').mockReturnValue(
      '<!DOCTYPE html><html><head><title>SMS OTP Burner</title></head><body><div id="root"></div></body></html>'
    );

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/html');
    expect(result.body).toContain('SMS OTP Burner');

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend blocks path traversal attempts', async () => {
    const event = {
      headers: {},
      pathParameters: { proxy: '../../../etc/passwd' },
    };

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain('Forbidden');
  });

  test('serveFrontend serves CSS files', async () => {
    const event = {
      headers: {},
      routeKey: 'GET /static/css/{proxy+}',
      pathParameters: { proxy: 'main.css' },
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('body { margin: 0; }');

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/css');

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend serves binary files as base64', async () => {
    const event = {
      headers: {},
      pathParameters: { proxy: 'favicon.ico' },
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from([0x00, 0x01, 0x02]));

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('image/vnd.microsoft.icon');
    expect(result.isBase64Encoded).toBe(true);

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend handles file system error', async () => {
    const event = {
      headers: {},
      pathParameters: { proxy: 'test.js' },
    };

    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('File system error');
    });

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(500);
    expect(result.headers['Content-Type']).toBe('text/html');
    expect(result.body).toContain('Error');

    fs.existsSync.mockRestore();
  });

  // =====================
  // MAX_LEASED_NUMBER_COUNT tests
  // =====================
  describe('MAX_LEASED_NUMBER_COUNT configuration', () => {
    test('leaseNumber respects MAX_LEASED_NUMBER_COUNT of 2', async () => {
      process.env.MAX_LEASED_NUMBER_COUNT = '2';

      jest.resetModules();
      mockFetch.mockReset();

      let postCount = 0;
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'POST') {
          postCount++;
          return Promise.resolve(createFetchResponse({
            virtualNumber: `+6141234567${postCount}`,
          }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
      expect(body.maxCount).toBe(2);
    });

    test('leaseNumber uses default MAX_LEASED_NUMBER_COUNT of 1', async () => {
      delete process.env.MAX_LEASED_NUMBER_COUNT;

      jest.resetModules();
      mockFetch.mockReset();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'POST') {
          return Promise.resolve(createFetchResponse({
            virtualNumber: '+61412345678',
          }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maxCount).toBe(1);
    });
  });
});
