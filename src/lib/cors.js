const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://sms.han.life').split(',');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const getRequestOrigin = (event) => event.headers?.origin || event.headers?.Origin;

const getCorsOrigin = (requestOrigin) => {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0];
};

const getResponseHeaders = (requestOrigin) => ({
  ...SECURITY_HEADERS,
  'Access-Control-Allow-Origin': getCorsOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
});

const createResponse = (statusCode, body, requestOrigin, extraHeaders = {}) => ({
  statusCode,
  headers: { ...getResponseHeaders(requestOrigin), ...extraHeaders },
  body: JSON.stringify(body),
});

const createErrorResponse = (statusCode, message, requestOrigin) =>
  createResponse(statusCode, { message }, requestOrigin);

module.exports = {
  ALLOWED_ORIGINS,
  SECURITY_HEADERS,
  getRequestOrigin,
  getCorsOrigin,
  getResponseHeaders,
  createResponse,
  createErrorResponse,
};
