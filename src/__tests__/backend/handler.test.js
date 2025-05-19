describe('Handler Functions', () => {
  const originalEnv = process.env;
  let handler;

  beforeEach(() => {
    // Reset modules before each test to ensure clean state
    jest.resetModules();
    jest.clearAllMocks();
    
    process.env = {
      ...originalEnv,
      TELSTRA_CLIENT_ID: 'test_client_id',
      TELSTRA_CLIENT_SECRET: 'test_client_secret'
    };
    
    // Require handler after setting env vars
    handler = require('../../handler');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Basic existence tests
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

  // Basic error handling tests
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
    // Remove env vars to trigger auth failure
    delete process.env.TELSTRA_CLIENT_ID;
    delete process.env.TELSTRA_CLIENT_SECRET;
    
    const event = {};
    
    const result = await handler.leaseNumber(event);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0); // No numbers leased due to auth failure
  });

  test('getNumber returns error when trying to get without setup', async () => {
    const result = await handler.getNumber({});
    
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Failed to check for active numbers with Telstra');
  });

  test('getAllVirtualNumbers handles missing credentials', async () => {
    // Remove env vars to trigger auth failure
    delete process.env.TELSTRA_CLIENT_ID;
    delete process.env.TELSTRA_CLIENT_SECRET;
    
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

  // ServeFrontend tests - mock filesystem for CI compatibility
  test('serveFrontend serves index.html for root path', async () => {
    const event = { pathParameters: null };
    
    // Mock fs.existsSync and fs.readFileSync to simulate index.html exists
    const fs = require('fs');
    
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Mock that index.html exists
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
    
    // Restore mocks
    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend handles empty pathParameters', async () => {
    const event = { pathParameters: {} };
    
    // Mock fs.existsSync and fs.readFileSync to simulate index.html exists
    const fs = require('fs');
    
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Mock that index.html exists
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
    
    // Restore mocks
    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  test('serveFrontend handles missing pathParameters', async () => {
    const event = {};
    
    // Mock fs.existsSync and fs.readFileSync to simulate index.html exists
    const fs = require('fs');
    
    jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      // Mock that index.html exists
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
    
    // Restore mocks
    fs.existsSync.mockRestore();
    fs.readFileSync.mockRestore();
  });

  // API routing tests
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
    
    // Should attempt to call leaseNumber function
    expect(result.statusCode).toBe(200); // Returns success with 0 numbers when auth fails
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });

  test('api routes DELETE /leaseNumber correctly', async () => {
    const event = {
      httpMethod: 'DELETE',
      pathParameters: { proxy: 'leaseNumber' },
      body: JSON.stringify({})
    };

    const result = await handler.api(event);
    
    // Should route to releaseNumber which will return 400 for missing number
    expect(result.statusCode).toBe(400);
  });

  test('api routes GET /virtual-numbers correctly', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { proxy: 'virtual-numbers' }
    };

    const result = await handler.api(event);
    
    // Should attempt to call getAllVirtualNumbers
    expect(result.statusCode).toBe(200); // getAllVirtualNumbers always returns 200
  });

  test('api routes GET /messages correctly', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/messages'
    };

    const result = await handler.api(event);
    
    // Should route to getMessages which will return 404 for no subscription
    expect(result.statusCode).toBe(404);
  });

  test('api handles path parsing correctly', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/api/messages',
      pathParameters: { proxy: 'messages' }
    };

    const result = await handler.api(event);
    
    expect(result.statusCode).toBe(404); // No active subscription
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
  });

  test('api handles missing path', async () => {
    const event = {
      httpMethod: 'GET'
    };

    const result = await handler.api(event);
    
    expect(result.statusCode).toBe(404);
  });

  // Additional edge case tests
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
    
    const result = await handler.leaseNumber({});
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });

  test('leaseNumber with empty env TELSTRA_CLIENT_SECRET', async () => {
    process.env.TELSTRA_CLIENT_SECRET = '';
    
    const result = await handler.leaseNumber({});
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.leasedCount).toBe(0);
  });    // Additional coverage tests
    test('api handles PUT method correctly', async () => {
        const event = {
            httpMethod: 'PUT',
            pathParameters: { proxy: 'test' }
        };
        
        const result = await handler.api(event);
        
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({ message: 'Route not found: PUT /api/test' });
    });

    test('serveFrontend handles static file routing with different extensions', async () => {
        const event = {
            routeKey: 'GET /static/js/{proxy+}',
            pathParameters: { proxy: 'main.js' }
        };
        
        // Mock fs.existsSync and fs.readFileSync to simulate index.html exists for fallback
        const fs = require('fs');
        
        jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
            // Mock that the requested file doesn't exist, but index.html does
            if (filePath.includes('index.html')) {
                return true;
            }
            return false;
        });
        
        jest.spyOn(fs, 'readFileSync').mockReturnValue(
            '<!DOCTYPE html><html><head><title>SMS OTP Burner</title></head><body><div id="root"></div></body></html>'
        );
        
        const result = await handler.serveFrontend(event);
        
        // Since the file doesn't exist in test environment, it should fall back to index.html
        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('text/html');
        expect(result.body).toContain('SMS OTP Burner');
        
        // Restore mocks
        fs.existsSync.mockRestore();
        fs.readFileSync.mockRestore();
    });

    test('serveFrontend handles missing index.html fallback', async () => {
        const event = {
            pathParameters: { proxy: 'nonexistent.js' }
        };
        
        // Mock fs.existsSync to return false for both the requested file and index.html
        const fs = require('fs');
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        
        const result = await handler.serveFrontend(event);
        
        expect(result.statusCode).toBe(404);
        expect(result.headers['Content-Type']).toBe('text/html');
        expect(result.body).toContain('React App Not Found');
        
        // Restore mock
        fs.existsSync.mockRestore();
    });

    test('serveFrontend handles file system error', async () => {
        const event = {
            pathParameters: { proxy: 'test.js' }
        };
        
        // Mock fs.existsSync to throw an error
        const fs = require('fs');
        jest.spyOn(fs, 'existsSync').mockImplementation(() => {
            throw new Error('File system error');
        });
        
        const result = await handler.serveFrontend(event);
        
        expect(result.statusCode).toBe(500);
        expect(result.headers['Content-Type']).toBe('text/html');
        expect(result.body).toContain('Error');
        
        // Restore mock
        fs.existsSync.mockRestore();
    });
});
