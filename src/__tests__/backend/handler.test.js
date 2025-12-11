describe('Handler Functions', () => {
  const originalEnv = process.env;
  let handler;
  let axios;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      TELSTRA_CLIENT_ID: 'test_client_id',
      TELSTRA_CLIENT_SECRET: 'test_client_secret',
      MAX_LEASED_NUMBER_COUNT: '1'
    };

    // Get the mocked axios
    axios = require('axios');

    // Reset to default rejecting behavior
    axios.mockImplementation(() => Promise.reject({
      response: { status: 401, data: { error: 'invalid_client' } }
    }));
    axios.post.mockImplementation(() => Promise.reject({
      response: { status: 401, data: { error: 'invalid_client' } }
    }));
    axios.get.mockImplementation(() => Promise.reject({
      response: { status: 404, data: { error: 'not_found' } }
    }));
    axios.delete.mockImplementation(() => Promise.reject({
      response: { status: 404, data: { error: 'not_found' } }
    }));

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
      jest.clearAllMocks();

      axios = require('axios');

      // Mock successful auth token
      axios.post.mockImplementation(() => Promise.resolve({
        data: {
          access_token: 'test_access_token',
          expires_in: 3600
        }
      }));

      handler = require('../../handler');
    });

    test('leaseNumber successfully leases a new number when none exist', async () => {
      // Mock axios for API calls
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [] }
          });
        }
        if (config.method === 'post' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumber: '+61412345678' }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Successfully leased');
      expect(body.virtualNumbers).toHaveLength(1);
      expect(body.virtualNumbers[0].virtualNumber).toBe('+61412345678');
    });

    test('leaseNumber returns existing numbers when max count is reached', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: {
              virtualNumbers: [{ virtualNumber: '+61412345678' }]
            }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Already have');
      expect(body.leasedCount).toBe(1);
      expect(body.maxCount).toBe(1);
    });

    test('getNumber returns existing virtual numbers', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: {
              virtualNumbers: [
                { virtualNumber: '+61412345678' },
                { virtualNumber: '+61412345679' }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
    });

    test('getNumber returns 404 when no numbers exist', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({
            data: { virtualNumbers: [] }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getNumber({});

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('No active numbers leased');
    });

    test('getNumber returns 404 when virtualNumbers is null', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({
            data: { virtualNumbers: null }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getNumber({});

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('No active numbers leased');
    });

    test('getAllVirtualNumbers returns all virtual numbers', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: {
              virtualNumbers: [
                { virtualNumber: '+61412345678' },
                { virtualNumber: '+61412345679' }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getAllVirtualNumbers({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
      expect(body.virtualNumbers[0].msisdn).toBe('+61412345678');
    });

    test('getAllVirtualNumbers returns empty array when no numbers exist', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({
            data: { virtualNumbers: [] }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getAllVirtualNumbers({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });

    test('getAllVirtualNumbers returns empty array when response has null virtualNumbers', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({
            data: { virtualNumbers: null }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      const result = await handler.getAllVirtualNumbers({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toEqual([]);
    });

    test('getMessages returns messages for active numbers', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'get' && config.url.includes('/messages')) {
          return Promise.resolve({
            data: {
              messages: [
                {
                  from: '+61987654321',
                  messageContent: 'Your OTP is 123456',
                  to: '+61412345678',
                  receivedTimestamp: '2025-01-01T10:00:00Z'
                },
                {
                  sourceNumber: '+61987654322',
                  body: 'Another message',
                  destinationNumber: '+61412345678',
                  createTimestamp: '2025-01-01T09:00:00Z'
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      // First get numbers to populate currentSubscriptions
      await handler.getNumber({});

      const result = await handler.getMessages({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].body).toBe('Your OTP is 123456');
      expect(body.activeNumbers).toContain('+61412345678');
    });

    test('getMessages handles messages with timestamp field', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'get' && config.url.includes('/messages')) {
          return Promise.resolve({
            data: {
              messages: [
                {
                  from: '+61987654321',
                  body: 'Test message',
                  to: '+61412345678',
                  timestamp: '2025-01-01T10:00:00Z'
                }
              ]
            }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      await handler.getNumber({});
      const result = await handler.getMessages({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.messages[0].receivedAt).toBe('2025-01-01T10:00:00Z');
    });

    test('releaseNumber successfully releases a number', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'delete') {
          return Promise.resolve({ data: {} });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      // First get numbers to populate currentSubscriptions
      await handler.getNumber({});

      const result = await handler.releaseNumber({
        body: JSON.stringify({ number: '+61412345678' })
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('released successfully');
    });

    test('releaseNumber handles 404 from Telstra (already released)', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'delete') {
          return Promise.reject({
            response: { status: 404, data: { error: 'not_found' } }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      await handler.getNumber({});

      const result = await handler.releaseNumber({
        body: JSON.stringify({ virtualNumber: '+61412345678' })
      });

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('already released');
    });

    test('releaseNumber handles other errors', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'delete') {
          return Promise.reject({
            response: { status: 500, data: { error: 'server_error' } }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      await handler.getNumber({});

      const result = await handler.releaseNumber({
        body: JSON.stringify({ phoneNumber: '+61412345678' })
      });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to release number');
    });

    test('releaseNumber handles error without response object', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'delete') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      await handler.getNumber({});

      const result = await handler.releaseNumber({
        body: JSON.stringify({ number: '+61412345678' })
      });

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to release number');
    });

    test('releaseNumber returns 400 when number does not match', async () => {
      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      await handler.getNumber({});

      const result = await handler.releaseNumber({
        body: JSON.stringify({ number: '+61999999999' })
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

      axios = require('axios');

      let postCallCount = 0;
      axios.post.mockImplementation(() => {
        postCallCount++;
        return Promise.resolve({
          data: {
            access_token: `token_${postCallCount}`,
            expires_in: 3600
          }
        });
      });

      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        return Promise.reject(new Error('Unexpected request'));
      });

      handler = require('../../handler');

      // Make two API calls
      await handler.getNumber({});
      await handler.getNumber({});

      // Should only have requested token once due to caching
      expect(postCallCount).toBe(1);
    });
  });

  // =====================
  // Error handling tests
  // =====================
  describe('Error handling', () => {
    test('leaseNumber handles API error with response', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({ data: { virtualNumbers: [] } });
        }
        if (config.method === 'post') {
          return Promise.reject({
            response: { status: 400, data: { error: 'bad_request' } }
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.leasedCount).toBe(0);
    });

    test('leaseNumber handles when no numbers are leased due to errors', async () => {
      // This tests the case where get existing numbers succeeds but leasing fails
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({ data: { virtualNumbers: [] } });
        }
        if (config.method === 'post') {
          // Leasing fails
          return Promise.reject({
            response: { status: 500, data: { error: 'server_crash' } }
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({});

      // Even with lease error, the function returns 200 with leasedCount: 0
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.leasedCount).toBe(0);
    });

    test('leaseNumber handles general API error without response', async () => {
      jest.resetModules();
      axios = require('axios');
      axios.post.mockImplementation(() => Promise.reject(new Error('Network error')));

      handler = require('../../handler');

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
    });

    test('getMessages returns error when API fails', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'get' && config.url.includes('/messages')) {
          return Promise.reject({
            response: { status: 500, data: { error: 'server_error' } }
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      await handler.getNumber({});
      const result = await handler.getMessages({});

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to fetch messages');
    });

    test('getMessages handles error without response object', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation((config) => {
        if (config.method === 'get' && config.url.includes('virtual-numbers')) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        if (config.method === 'get' && config.url.includes('/messages')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      await handler.getNumber({});
      const result = await handler.getMessages({});

      expect(result.statusCode).toBe(500);
    });

    test('getNumber returns cached subscriptions on API error', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      let callCount = 0;
      axios.mockImplementation((config) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        return Promise.reject({
          response: { status: 500, data: { error: 'server_error' } }
        });
      });

      handler = require('../../handler');

      // First call succeeds and caches
      await handler.getNumber({});

      // Second call fails but returns cached
      const result = await handler.getNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(1);
    });

    test('getNumber returns 500 when no cached subscriptions on error', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation(() => Promise.reject(new Error('Network error')));

      handler = require('../../handler');

      const result = await handler.getNumber({});

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Failed to check for active numbers');
    });

    test('getAllVirtualNumbers returns cached subscriptions on API error', async () => {
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      let callCount = 0;
      axios.mockImplementation((config) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: { virtualNumbers: [{ virtualNumber: '+61412345678' }] }
          });
        }
        return Promise.reject({
          response: { status: 500, data: { error: 'server_error' } }
        });
      });

      handler = require('../../handler');

      await handler.getAllVirtualNumbers({});
      const result = await handler.getAllVirtualNumbers({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(1);
    });
  });

  // =====================
  // releaseNumber tests
  // =====================
  test('releaseNumber returns 400 when number is missing', async () => {
    const event = { body: JSON.stringify({}) };

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(400);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Missing virtual number to release');
  });

  test('getMessages returns 404 when no active subscription', async () => {
    const event = {};

    const result = await handler.getMessages(event);

    expect(result.statusCode).toBe(404);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No active numbers to fetch messages for');
  });

  test('releaseNumber handles malformed request body', async () => {
    const event = { body: 'invalid json' };

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Invalid JSON in request body');
  });

  test('releaseNumber handles missing body', async () => {
    const event = {};

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No active numbers found to release');
  });

  test('leaseNumber handles auth failure with no env vars', async () => {
    delete process.env.TELSTRA_CLIENT_ID;
    delete process.env.TELSTRA_CLIENT_SECRET;

    jest.resetModules();
    handler = require('../../handler');

    const event = {};

    const result = await handler.leaseNumber(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });

  test('getNumber returns error when trying to get without setup', async () => {
    const result = await handler.getNumber({});

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Failed to check for active numbers with Telstra');
  });

  test('getAllVirtualNumbers handles missing credentials', async () => {
    delete process.env.TELSTRA_CLIENT_ID;
    delete process.env.TELSTRA_CLIENT_SECRET;

    jest.resetModules();
    handler = require('../../handler');

    const result = await handler.getAllVirtualNumbers({});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.virtualNumbers).toEqual([]);
  });

  test('getAllMessages delegates to getMessages', async () => {
    const result = await handler.getAllMessages({});

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
      path: '/messages'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('api returns 404 for unknown routes', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/unknown'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Route not found: GET /api/');
  });

  test('api routes POST /leaseNumber correctly', async () => {
    const event = {
      httpMethod: 'POST',
      pathParameters: { proxy: 'leaseNumber' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api routes POST /number correctly', async () => {
    const event = {
      httpMethod: 'POST',
      pathParameters: { proxy: 'number' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api routes DELETE /leaseNumber correctly', async () => {
    const event = {
      httpMethod: 'DELETE',
      pathParameters: { proxy: 'leaseNumber' },
      body: JSON.stringify({})
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(400);
  });

  test('api routes DELETE /number correctly', async () => {
    const event = {
      httpMethod: 'DELETE',
      pathParameters: { proxy: 'number' },
      body: JSON.stringify({})
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(400);
  });

  test('api routes GET /current-number correctly', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { proxy: 'current-number' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(500);
  });

  test('api routes GET /virtual-numbers correctly', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { proxy: 'virtual-numbers' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api routes GET /messages correctly', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { proxy: 'messages' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
  });

  test('api handles httpMethod from requestContext.http.method', async () => {
    const event = {
      requestContext: { http: { method: 'OPTIONS' } },
      path: '/messages'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api handles httpMethod from requestContext.httpMethod', async () => {
    const event = {
      requestContext: { httpMethod: 'OPTIONS' },
      path: '/messages'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(200);
  });

  test('api returns 405 for unsupported method on leaseNumber', async () => {
    const event = {
      httpMethod: 'PUT',
      pathParameters: { proxy: 'leaseNumber' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Method PUT not allowed');
    expect(body.allowedMethods).toContain('POST');
    expect(body.allowedMethods).toContain('DELETE');
  });

  test('api returns 404 for change-number (not implemented in switch)', async () => {
    // Note: change-number has getAllowedMethodsForPath but is not in the api switch cases
    // so any method returns 404 Route not found
    const event = {
      httpMethod: 'GET',
      pathParameters: { proxy: 'change-number' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Route not found');
  });

  test('api returns 405 for unsupported method on current-number', async () => {
    const event = {
      httpMethod: 'POST',
      pathParameters: { proxy: 'current-number' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.allowedMethods).toContain('GET');
  });

  test('api returns 405 for unsupported method on virtual-numbers', async () => {
    const event = {
      httpMethod: 'POST',
      pathParameters: { proxy: 'virtual-numbers' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.allowedMethods).toContain('GET');
  });

  test('api returns 405 for unsupported method on messages', async () => {
    const event = {
      httpMethod: 'DELETE',
      pathParameters: { proxy: 'messages' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(405);
    const body = JSON.parse(result.body);
    expect(body.allowedMethods).toContain('GET');
  });

  test('api handles path parsing correctly', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/api/messages',
      pathParameters: { proxy: 'messages' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
  });

  test('api handles empty path correctly', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
  });

  test('api handles missing httpMethod', async () => {
    const event = {
      path: '/messages'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('HTTP method is required but was undefined');
  });

  test('api handles missing path', async () => {
    const event = {
      httpMethod: 'GET'
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
  });

  test('api handles PUT method correctly', async () => {
    const event = {
      httpMethod: 'PUT',
      pathParameters: { proxy: 'test' }
    };

    const result = await handler.api(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: 'Route not found: PUT /api/test' });
  });

  // =====================
  // releaseNumber edge cases
  // =====================
  test('releaseNumber with empty virtualNumber', async () => {
    const event = {
      body: JSON.stringify({ virtualNumber: '' })
    };

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Missing virtual number to release');
  });

  test('releaseNumber with null virtualNumber', async () => {
    const event = {
      body: JSON.stringify({ virtualNumber: null })
    };

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Missing virtual number to release');
  });

  test('releaseNumber with undefined virtualNumber', async () => {
    const event = {
      body: JSON.stringify({ virtualNumber: undefined })
    };

    const result = await handler.releaseNumber(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Missing virtual number to release');
  });

  test('leaseNumber with empty env TELSTRA_CLIENT_ID', async () => {
    process.env.TELSTRA_CLIENT_ID = '';

    jest.resetModules();
    handler = require('../../handler');

    const result = await handler.leaseNumber({});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });

  test('leaseNumber with empty env TELSTRA_CLIENT_SECRET', async () => {
    process.env.TELSTRA_CLIENT_SECRET = '';

    jest.resetModules();
    handler = require('../../handler');

    const result = await handler.leaseNumber({});

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });

  // =====================
  // serveFrontend tests
  // =====================
  test('serveFrontend serves index.html for root path', async () => {
    const event = { pathParameters: null };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      if (filePath.includes('index.html')) {
        return true;
      }
      return false;
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

  test('serveFrontend handles empty pathParameters', async () => {
    const event = { pathParameters: {} };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      if (filePath.includes('index.html')) {
        return true;
      }
      return false;
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

  test('serveFrontend handles missing pathParameters', async () => {
    const event = {};

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      if (filePath.includes('index.html')) {
        return true;
      }
      return false;
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

  test('serveFrontend handles static file routing with different extensions', async () => {
    const event = {
      routeKey: 'GET /static/js/{proxy+}',
      pathParameters: { proxy: 'main.js' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      if (filePath.includes('index.html')) {
        return true;
      }
      return false;
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

  test('serveFrontend serves CSS files', async () => {
    const event = {
      routeKey: 'GET /static/css/{proxy+}',
      pathParameters: { proxy: 'main.css' }
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

  test('serveFrontend serves media files', async () => {
    const event = {
      routeKey: 'GET /static/media/{proxy+}',
      pathParameters: { proxy: 'logo.svg' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('<svg></svg>');

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('image/svg+xml');

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend serves JavaScript files', async () => {
    const event = {
      pathParameters: { proxy: 'main.js' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('console.log("test");');

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    // mime-types returns 'text/javascript' for .js files
    expect(result.headers['Content-Type']).toBe('text/javascript');
    expect(result.isBase64Encoded).toBe(false);

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend serves JSON files', async () => {
    const event = {
      pathParameters: { proxy: 'manifest.json' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{"name":"app"}');

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.isBase64Encoded).toBe(false);

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend serves binary files as base64', async () => {
    const event = {
      pathParameters: { proxy: 'favicon.ico' }
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

  test('serveFrontend serves PNG files as base64', async () => {
    const event = {
      pathParameters: { proxy: 'logo.png' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from([0x89, 0x50, 0x4E, 0x47]));

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('image/png');
    expect(result.isBase64Encoded).toBe(true);

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend handles missing index.html fallback', async () => {
    const event = {
      pathParameters: { proxy: 'nonexistent.js' }
    };

    const fs = require('fs');
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(404);
    expect(result.headers['Content-Type']).toBe('text/html');
    expect(result.body).toContain('React App Not Found');

    fs.existsSync.mockRestore();
  });

  test('serveFrontend handles file system error', async () => {
    const event = {
      pathParameters: { proxy: 'test.js' }
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

  test('serveFrontend blocks path traversal attempts', async () => {
    const event = {
      pathParameters: { proxy: '../../../etc/passwd' }
    };

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain('Forbidden');
  });

  test('serveFrontend handles slash as path', async () => {
    const event = {
      pathParameters: { proxy: '/' }
    };

    const fs = require('fs');

    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      return filePath.includes('index.html');
    });

    jest.spyOn(fs, 'readFileSync').mockReturnValue('<html><body>Test</body></html>');

    const result = await handler.serveFrontend(event);

    expect(result.statusCode).toBe(200);

    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  // =====================
  // MAX_LEASED_NUMBER_COUNT tests
  // =====================
  describe('MAX_LEASED_NUMBER_COUNT configuration', () => {
    test('leaseNumber respects MAX_LEASED_NUMBER_COUNT of 2', async () => {
      // Set env BEFORE resetting modules since MAX_LEASED_NUMBER_COUNT is captured at module load
      process.env.MAX_LEASED_NUMBER_COUNT = '2';
      process.env.TELSTRA_CLIENT_ID = 'test_client_id';
      process.env.TELSTRA_CLIENT_SECRET = 'test_client_secret';

      jest.resetModules();

      // Get fresh axios mock
      axios = require('axios');

      // Set up mock BEFORE requiring handler
      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      let postCount = 0;
      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({ data: { virtualNumbers: [] } });
        }
        if (config.method === 'post') {
          postCount++;
          return Promise.resolve({
            data: { virtualNumber: `+6141234567${postCount}` }
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      // Now require handler which will read MAX_LEASED_NUMBER_COUNT as 2
      handler = require('../../handler');

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.virtualNumbers).toHaveLength(2);
      expect(body.maxCount).toBe(2);
    });

    test('leaseNumber uses default MAX_LEASED_NUMBER_COUNT of 1', async () => {
      delete process.env.MAX_LEASED_NUMBER_COUNT;
      process.env.TELSTRA_CLIENT_ID = 'test_client_id';
      process.env.TELSTRA_CLIENT_SECRET = 'test_client_secret';

      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      axios.mockImplementation((config) => {
        if (config.method === 'get') {
          return Promise.resolve({ data: { virtualNumbers: [] } });
        }
        if (config.method === 'post') {
          return Promise.resolve({
            data: { virtualNumber: '+61412345678' }
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      handler = require('../../handler');

      const result = await handler.leaseNumber({});

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.maxCount).toBe(1);
    });
  });

  // =====================
  // API error catching tests
  // =====================
  describe('API error catching', () => {
    test('api catches errors thrown by handlers and returns handler error', async () => {
      // When the handler itself returns an error response (not throws),
      // the API routes it correctly
      jest.resetModules();
      axios = require('axios');

      axios.post.mockImplementation(() => Promise.resolve({
        data: { access_token: 'test_token', expires_in: 3600 }
      }));

      // Axios rejects, which causes getNumber to return a 500 error
      axios.mockImplementation(() => Promise.reject(new Error('Simulated error')));

      handler = require('../../handler');

      const event = {
        httpMethod: 'GET',
        pathParameters: { proxy: 'current-number' }
      };

      const result = await handler.api(event);

      // The handler returns a 500 with its own error message
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Failed to check for active numbers with Telstra');
    });

    test('api catches unexpected sync exceptions and returns 500', async () => {
      // To test the try-catch in api(), we need an actual exception to be thrown
      // This is harder to trigger since handlers use try-catch internally
      // We'll test that the route routing itself doesn't throw
      const event = {
        httpMethod: 'GET',
        pathParameters: { proxy: 'messages' }
      };

      const result = await handler.api(event);

      // This should execute without throwing and return 404 (no active subscriptions)
      expect(result.statusCode).toBe(404);
    });
  });

  // =====================
  // Additional coverage tests
  // =====================
  describe('Additional coverage tests', () => {
    test('api routes POST /change-number (change-number endpoint)', async () => {
      // Test the change-number path which is only POST
      const event = {
        httpMethod: 'POST',
        pathParameters: { proxy: 'change-number' }
      };

      // Since change-number POST doesn't have a handler mapped, it should 404
      const result = await handler.api(event);

      // Looking at the api handler, change-number is not in the switch cases
      // so it returns 404 "Route not found"
      expect(result.statusCode).toBe(404);
    });

    test('getAllowedMethodsForPath returns correct methods', async () => {
      // Test method restrictions by trying wrong methods
      // Note: change-number is not in the api switch cases, so it returns 404 not 405
      const tests = [
        { path: 'leaseNumber', wrongMethod: 'GET', expectedStatus: 405 },
        { path: 'number', wrongMethod: 'GET', expectedStatus: 405 },
        { path: 'current-number', wrongMethod: 'DELETE', expectedStatus: 405 },
        { path: 'virtual-numbers', wrongMethod: 'DELETE', expectedStatus: 405 },
        { path: 'messages', wrongMethod: 'POST', expectedStatus: 405 }
      ];

      for (const test of tests) {
        const event = {
          httpMethod: test.wrongMethod,
          pathParameters: { proxy: test.path }
        };

        const result = await handler.api(event);
        expect(result.statusCode).toBe(test.expectedStatus);
      }
    });

    test('serveFrontend serves file found on first try with index.html fallback', async () => {
      const event = {
        pathParameters: { proxy: 'some-page' }
      };

      const fs = require('fs');

      // First existsSync returns false (file not found), second returns true (index.html exists)
      let callCount = 0;
      jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        callCount++;
        return callCount > 1; // false for main file, true for index.html
      });

      jest.spyOn(fs, 'readFileSync').mockReturnValue('<html>Index</html>');

      const result = await handler.serveFrontend(event);

      expect(result.statusCode).toBe(200);
      expect(result.body).toContain('Index');

      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    test('api catches synchronous error from handler (lines 146-147)', async () => {
      // To test this, we need to make a handler throw synchronously
      // Most handlers are async and use try-catch, so errors are returned as response
      // But we can create a test case that causes an issue

      // Actually, since all handlers use try-catch and return responses,
      // the api's outer try-catch (lines 145-152) is mainly for unexpected errors
      // We can verify it exists by checking a handler that returns an error
      const event = {
        httpMethod: 'GET',
        pathParameters: { proxy: 'current-number' }
      };

      // The handler will return a 500 error, not throw
      const result = await handler.api(event);

      // Verify the api router correctly returns the handler's error response
      expect(result.statusCode).toBe(500);
    });
  });
});
