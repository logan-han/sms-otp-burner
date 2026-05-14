const IS_DEBUG = process.env.DEBUG === 'true';

const SENSITIVE_FIELDS = ['authorization', 'Authorization', 'client_secret', 'access_token', 'body'];

const sanitizeLogData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) sanitized[field] = '[REDACTED]';
  }
  if (sanitized.headers && typeof sanitized.headers === 'object') {
    sanitized.headers = { ...sanitized.headers };
    for (const field of SENSITIVE_FIELDS) {
      if (field in sanitized.headers) sanitized.headers[field] = '[REDACTED]';
    }
  }
  return sanitized;
};

const log = {
  info: (message, data = {}) => {
    if (IS_DEBUG) {
      console.log(`[INFO] ${message}`, JSON.stringify(sanitizeLogData(data)));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${message}`, IS_DEBUG ? JSON.stringify(sanitizeLogData(data)) : '');
  },
  error: (message, error = null) => {
    const errorInfo = error ? { message: error.message, status: error.status } : {};
    console.error(`[ERROR] ${message}`, JSON.stringify(errorInfo));
  },
};

module.exports = { IS_DEBUG, log, sanitizeLogData };
