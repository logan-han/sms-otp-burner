const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { getRequestOrigin, getResponseHeaders } = require('./cors');
const { log } = require('./log');

const BUILD_DIR = path.resolve(__dirname, '..', '..', 'build');

const resolveRequestedPath = (event) => {
  let requestedPath = event.pathParameters?.proxy || 'index.html';
  if (requestedPath === '/' || requestedPath === '') {
    requestedPath = 'index.html';
  }

  const routeKey = event.routeKey || '';
  if (routeKey.includes('/static/js/')) {
    requestedPath = `static/js/${event.pathParameters.proxy}`;
  } else if (routeKey.includes('/static/css/')) {
    requestedPath = `static/css/${event.pathParameters.proxy}`;
  } else if (routeKey.includes('/static/media/')) {
    requestedPath = `static/media/${event.pathParameters.proxy}`;
  }
  return requestedPath;
};

const isTextContent = (contentType) =>
  contentType.startsWith('text/')
  || contentType.includes('javascript')
  || contentType.includes('json')
  || contentType.includes('css')
  || contentType.includes('html');

const serveFile = (filePath, requestOrigin) => {
  const contentType = mime.lookup(filePath) || 'application/octet-stream';
  const headers = { ...getResponseHeaders(requestOrigin), 'Content-Type': contentType };
  if (isTextContent(contentType)) {
    return {
      statusCode: 200,
      headers,
      body: fs.readFileSync(filePath, 'utf-8'),
      isBase64Encoded: false,
    };
  }
  return {
    statusCode: 200,
    headers,
    body: fs.readFileSync(filePath).toString('base64'),
    isBase64Encoded: true,
  };
};

const serveSpaFallback = (requestOrigin) => {
  const indexPath = path.resolve(BUILD_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return {
      statusCode: 200,
      headers: { ...getResponseHeaders(requestOrigin), 'Content-Type': 'text/html' },
      body: fs.readFileSync(indexPath, 'utf-8'),
    };
  }
  return {
    statusCode: 404,
    headers: { ...getResponseHeaders(requestOrigin), 'Content-Type': 'text/html' },
    body: '<html><body><h1>React App Not Found</h1><p>Please run <code>yarn build:react</code>.</p></body></html>',
  };
};

const serveFrontend = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  log.info('Frontend request', { path: event.path || event.rawPath });

  const requestedPath = resolveRequestedPath(event);
  let filePath = path.resolve(BUILD_DIR, requestedPath);

  if (!filePath.startsWith(BUILD_DIR)) {
    log.warn('Path traversal attempt blocked', { requestedPath });
    return {
      statusCode: 403,
      headers: { ...getResponseHeaders(requestOrigin), 'Content-Type': 'text/html' },
      body: '<html><body><h1>403 Forbidden</h1><p>Access denied.</p></body></html>',
    };
  }

  try {
    if (requestedPath === 'favicon.ico' && !fs.existsSync(filePath)) {
      filePath = path.resolve(BUILD_DIR, 'favicon.svg');
    }
    if (fs.existsSync(filePath)) {
      return serveFile(filePath, requestOrigin);
    }
    return serveSpaFallback(requestOrigin);
  } catch (error) {
    log.error('Error serving frontend', error);
    return {
      statusCode: 500,
      headers: { ...getResponseHeaders(requestOrigin), 'Content-Type': 'text/html' },
      body: '<html><body><h1>Error</h1><p>Could not load the application.</p></body></html>',
    };
  }
};

module.exports = { serveFrontend };
