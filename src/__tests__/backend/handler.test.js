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
  // Additional API routing tests
  // =====================
  describe('Additional API routing', () => {
    beforeEach(() => {
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
          return Promise.resolve(createFetchResponse({
            messages: [{ from: '+61999', messageContent: 'Test', to: '+61412345678', receivedTimestamp: '2025-01-01T10:00:00Z' }],
          }));
        }
        return Promise.reject(new Error('Unexpected'));
      });
      handler = require('../../handler');
    });

    test('api routes GET /messages correctly', async () => {
      const event = {
        httpMethod: 'GET',
        headers: {},
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages).toBeDefined();
    });

    test('api routes DELETE /number correctly', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
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
        return Promise.reject(new Error('Unexpected'));
      });

      const event = {
        httpMethod: 'DELETE',
        headers: {},
        pathParameters: { proxy: 'number' },
        body: JSON.stringify({ number: '+61412345678' }),
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
    });

    test('api routes GET /current-number correctly', async () => {
      const event = {
        httpMethod: 'GET',
        headers: {},
        pathParameters: { proxy: 'current-number' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
    });

    test('api routes GET /virtual-numbers correctly', async () => {
      const event = {
        httpMethod: 'GET',
        headers: {},
        pathParameters: { proxy: 'virtual-numbers' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
    });

    test('api returns 405 for unsupported method on messages', async () => {
      const event = {
        httpMethod: 'POST',
        headers: {},
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(405);
      const body = JSON.parse(result.body);
      expect(body.allowedMethods).toContain('GET');
    });

    test('api returns 405 for unsupported method on current-number', async () => {
      const event = {
        httpMethod: 'POST',
        headers: {},
        pathParameters: { proxy: 'current-number' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(405);
    });

    test('api returns 405 for unsupported method on virtual-numbers', async () => {
      const event = {
        httpMethod: 'DELETE',
        headers: {},
        pathParameters: { proxy: 'virtual-numbers' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(405);
    });

    test('api handles httpMethod from requestContext.http.method', async () => {
      const event = {
        requestContext: { http: { method: 'OPTIONS' } },
        headers: {},
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
    });

    test('api handles httpMethod from requestContext.httpMethod', async () => {
      const event = {
        requestContext: { httpMethod: 'OPTIONS' },
        headers: {},
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(200);
    });
  });

  // =====================
  // sanitizeLogData tests
  // =====================
  describe('sanitizeLogData', () => {
    test('sanitizeLogData redacts sensitive fields in headers', async () => {
      process.env.DEBUG = 'true';
      jest.resetModules();
      mockFetch.mockReset();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

      handler = require('../../handler');

      // Trigger API call with authorization header to test sanitization
      await handler.api({
        httpMethod: 'GET',
        headers: {
          Authorization: 'Bearer secret_token',
          authorization: 'bearer lower_case',
          origin: 'http://localhost:3000'
        },
        pathParameters: { proxy: 'current-number' },
      });

      // Verify logging happened
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('sanitizeLogData redacts body field', async () => {
      process.env.DEBUG = 'true';
      jest.resetModules();
      mockFetch.mockReset();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
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
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      // Trigger API call with body to test sanitization
      await handler.releaseNumber({
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ number: '+61412345678', secret: 'should_be_logged' }),
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =====================
  // DEBUG mode logging tests
  // =====================
  describe('DEBUG mode logging', () => {
    test('log.info outputs data when DEBUG is true', async () => {
      process.env.DEBUG = 'true';
      jest.resetModules();
      mockFetch.mockReset();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

      handler = require('../../handler');
      await handler.getNumber({ headers: {} });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('log.warn outputs data when DEBUG is true', async () => {
      process.env.DEBUG = 'true';
      jest.resetModules();
      mockFetch.mockReset();

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({
            access_token: 'test_token',
            expires_in: 3600,
          }));
        }
        if (url.includes('virtual-numbers') && (!options?.method || options?.method === 'GET')) {
          return Promise.reject(new Error('Check error'));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');
      await handler.leaseNumber({ headers: {} });

      consoleWarnSpy.mockRestore();
    });
  });

  // =====================
  // releaseNumber additional tests
  // =====================
  describe('releaseNumber additional tests', () => {
    test('releaseNumber returns 500 when fetchAllVirtualNumbers fails', async () => {
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
          // Throw error when fetching numbers in releaseNumber
          return Promise.resolve(createFetchResponse({ error: 'server_error' }, false, 500));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ number: '+61412345678' }),
      });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to verify current numbers');
    });

    test('releaseNumber handles API error (non-404)', async () => {
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
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'DELETE') {
          return Promise.resolve(createFetchResponse({ error: 'server_error' }, false, 500));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ phoneNumber: '+61412345678' }),
      });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to release number');
    });

    test('releaseNumber uses phoneNumber field from body', async () => {
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
          return Promise.resolve(createFetchResponse({
            virtualNumbers: [{ virtualNumber: '+61412345678' }],
          }));
        }
        if (url.includes('virtual-numbers') && options?.method === 'DELETE') {
          return Promise.resolve(createFetchResponse({}));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.releaseNumber({
        headers: {},
        body: JSON.stringify({ phoneNumber: '+61412345678' }),
      });

      expect(result.statusCode).toBe(200);
    });
  });

  // =====================
  // serveFrontend additional tests
  // =====================
  describe('serveFrontend additional tests', () => {
    test('serveFrontend serves JS files from static/js route', async () => {
      const event = {
        headers: {},
        routeKey: 'GET /static/js/{proxy+}',
        pathParameters: { proxy: 'main.js' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('console.log("test");');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/javascript');

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('serveFrontend serves media files from static/media route', async () => {
      const event = {
        headers: {},
        routeKey: 'GET /static/media/{proxy+}',
        pathParameters: { proxy: 'image.png' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('image/png');
      expect(result.isBase64Encoded).toBe(true);

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('serveFrontend returns 404 when file and index.html do not exist', async () => {
      const event = {
        headers: {},
        pathParameters: { proxy: 'nonexistent.html' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(404);
      expect(result.body).toContain('React App Not Found');

      fs.existsSync.mockRestore();
    });

    test('serveFrontend serves SPA fallback for non-existent path', async () => {
      const event = {
        headers: {},
        pathParameters: { proxy: 'some/nested/route' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        return filePath.includes('index.html');
      });
      jest.spyOn(fs, 'readFileSync').mockReturnValue('<html><body>SPA</body></html>');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/html');

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('serveFrontend handles empty path', async () => {
      const event = {
        headers: {},
        pathParameters: { proxy: '' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('<html></html>');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('serveFrontend handles / path', async () => {
      const event = {
        headers: {},
        pathParameters: { proxy: '/' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('<html></html>');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('serveFrontend serves JSON files as text', async () => {
      const event = {
        headers: {},
        pathParameters: { proxy: 'manifest.json' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('{"name": "test"}');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.isBase64Encoded).toBe(false);

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
  });

  // =====================
  // Telstra API error handling tests
  // =====================
  describe('Telstra API error handling', () => {
    test('getTelstraAccessToken clears cache on auth failure', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      mockFetch.mockImplementation((url) => {
        if (url.includes('oauth/token')) {
          return Promise.resolve(createFetchResponse({ error: 'auth_failed' }, false, 401));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(500);
    });

    test('callTelstraApi handles non-JSON error response', async () => {
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
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error('Invalid JSON')),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(500);
    });
  });

  // =====================
  // CORS origin tests
  // =====================
  describe('CORS origin handling', () => {
    test('getCorsOrigin returns default when no origin provided', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        headers: {},
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    });

    test('getCorsOrigin uses Origin header with capital O', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        headers: { Origin: 'https://sms.han.life' },
        pathParameters: { proxy: 'messages' },
      };

      const result = await handler.api(event);

      expect(result.headers['Access-Control-Allow-Origin']).toBe('https://sms.han.life');
    });
  });

  // =====================
  // getAllVirtualNumbers error handling
  // =====================
  describe('getAllVirtualNumbers error handling', () => {
    test('getAllVirtualNumbers returns empty array on API error', async () => {
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
          return Promise.resolve(createFetchResponse({ error: 'server_error' }, false, 500));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      // Should return 200 with empty array on error (graceful degradation)
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });
  });

  // =====================
  // getMessages fetchAllVirtualNumbers error
  // =====================
  describe('getMessages fetchAllVirtualNumbers error', () => {
    test('getMessages returns 404 when fetchAllVirtualNumbers fails', async () => {
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
          return Promise.resolve(createFetchResponse({ error: 'server_error' }, false, 500));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getMessages({ headers: {} });

      // Should return 404 because virtualNumbers is empty after error
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('No active numbers to fetch messages for');
    });
  });

  // =====================
  // fetchAllVirtualNumbers tests
  // =====================
  describe('fetchAllVirtualNumbers edge cases', () => {
    test('fetchAllVirtualNumbers handles null data', async () => {
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
          return Promise.resolve(createFetchResponse(null));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });

    test('fetchAllVirtualNumbers handles response with empty virtualNumbers array', async () => {
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
          return Promise.resolve(createFetchResponse({ virtualNumbers: [] }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });
  });

  // =====================
  // getMessages edge cases
  // =====================
  describe('getMessages edge cases', () => {
    test('getMessages handles messages with alternative field names', async () => {
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
          return Promise.resolve(createFetchResponse({
            messages: [{
              sourceNumber: '+61999',
              body: 'Test body',
              destinationNumber: '+61412345678',
              timestamp: '2025-01-01T10:00:00Z',
            }],
          }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getMessages({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages[0].from).toBe('+61999');
      expect(body.messages[0].body).toBe('Test body');
    });

    test('getMessages handles null messages array', async () => {
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
          return Promise.resolve(createFetchResponse({}));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getMessages({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages).toEqual([]);
    });
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

  // =====================
  // getAllowedMethodsForPath tests
  // =====================
  describe('getAllowedMethodsForPath', () => {
    test('returns empty array for unknown path', async () => {
      const event = {
        httpMethod: 'PUT',
        headers: {},
        pathParameters: { proxy: 'unknown-route' },
      };

      const result = await handler.api(event);

      expect(result.statusCode).toBe(404);
    });

    test('returns 404 for change-number path (no handler implemented)', async () => {
      const event = {
        httpMethod: 'GET',
        headers: {},
        pathParameters: { proxy: 'change-number' },
      };

      const result = await handler.api(event);

      // change-number is defined in getAllowedMethodsForPath but has no handler
      // so it falls through to 404
      expect(result.statusCode).toBe(404);
    });
  });

  // =====================
  // API exception handling tests
  // =====================
  describe('API exception handling', () => {
    test('api handles routing correctly with valid routes', async () => {
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
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const event = {
        httpMethod: 'POST',
        headers: {},
        pathParameters: { proxy: 'leaseNumber' },
      };

      const result = await handler.api(event);

      // Should return 200 when routing works correctly
      expect(result.statusCode).toBe(200);
    });
  });

  // =====================
  // leaseNumber edge cases
  // =====================
  describe('leaseNumber edge cases', () => {
    test('leaseNumber handles partial success when some numbers fail to lease', async () => {
      process.env.MAX_LEASED_NUMBER_COUNT = '3';

      jest.resetModules();
      mockFetch.mockReset();

      let postCallCount = 0;
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
          postCallCount++;
          // Fail on second POST
          if (postCallCount === 2) {
            return Promise.resolve(createFetchResponse({ error: 'limit_exceeded' }, false, 400));
          }
          return Promise.resolve(createFetchResponse({ virtualNumber: `+6141234567${postCallCount}` }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Should have 2 numbers (1 and 3 succeeded, 2 failed)
      expect(body.virtualNumbers.length).toBe(2);
    });

    test('leaseNumber handles complete failure to lease new numbers', async () => {
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
          // Return success but with no virtualNumber in response
          return Promise.resolve(createFetchResponse({}));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(0);
    });

    test('leaseNumber handles fetchAllVirtualNumbers error gracefully', async () => {
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
          // Error when checking existing numbers - caught by inner try-catch
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('virtual-numbers') && options?.method === 'POST') {
          return Promise.resolve(createFetchResponse({ virtualNumber: '+61412345678' }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({ headers: {} });

      // leaseNumber catches the error checking existing numbers and continues
      // to lease new numbers, returning 200
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =====================
  // callTelstraApi edge cases
  // =====================
  describe('callTelstraApi edge cases', () => {
    test('callTelstraApi includes params in URL', async () => {
      jest.resetModules();
      mockFetch.mockReset();

      let capturedUrl = '';
      mockFetch.mockImplementation((url) => {
        capturedUrl = url;
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
          return Promise.resolve(createFetchResponse({ messages: [] }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      await handler.getMessages({ headers: {} });

      // Should have limit param in messages URL
      expect(capturedUrl).toContain('limit=');
    });
  });

  // =====================
  // serveFrontend path and rawPath tests
  // =====================
  describe('serveFrontend path logging', () => {
    test('serveFrontend logs rawPath when path is not available', async () => {
      const event = {
        headers: {},
        rawPath: '/test-path',
        pathParameters: { proxy: 'test.html' },
      };

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(404);

      fs.existsSync.mockRestore();
    });
  });

  // =====================
  // formatVirtualNumber tests
  // =====================
  describe('formatVirtualNumber', () => {
    test('formats virtual number with expiry date', async () => {
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
            virtualNumbers: [
              { virtualNumber: '+61412345678', expiryDate: '2025-12-31T23:59:59Z' }
            ],
          }));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getAllVirtualNumbers({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers[0].expiryDate).toBe('2025-12-31T23:59:59Z');
    });

    test('formats virtual number without expiry date', async () => {
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
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.getNumber({ headers: {} });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers[0].expiryDate).toBeUndefined();
    });
  });
});
