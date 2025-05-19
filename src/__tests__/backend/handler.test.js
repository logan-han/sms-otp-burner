describe('Handler Functions', () => {
  const originalEnv = process.env;
  let handler;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    process.env = {
      ...originalEnv,
      TELSTRA_CLIENT_ID: 'test_client_id',
      TELSTRA_CLIENT_SECRET: 'test_client_secret'
    };
    
    handler = require('../../handler');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

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
    
    expect(result.statusCode).toBe(400);
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
      path: '/messages'
    };

    const result = await handler.api(event);
    
    expect(result.statusCode).toBe(404);
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
  });

  test('api handles missing path', async () => {
    const event = {
      httpMethod: 'GET'
    };

    const result = await handler.api(event);
    
    expect(result.statusCode).toBe(404);
  });

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
});
