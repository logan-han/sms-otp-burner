const {
  createErrorResponse,
  createResponse,
  getRequestOrigin,
  getResponseHeaders,
} = require('./lib/cors');
const { log, sanitizeLogData } = require('./lib/log');
const { serveFrontend } = require('./lib/serve-frontend');

const TELSTRA_API_BASE_URL = 'https://products.api.telstra.com/messaging/v3';
const TELSTRA_AUTH_URL = 'https://products.api.telstra.com/v2/oauth/token';
const TELSTRA_API_SCOPES = 'free-trial-numbers:read free-trial-numbers:write messages:read messages:write virtual-numbers:read virtual-numbers:write reports:read reports:write';

const MAX_LEASED_NUMBER_COUNT = parseInt(process.env.MAX_LEASED_NUMBER_COUNT) || 1;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const MESSAGES_FETCH_LIMIT = 50;

let accessToken = null;
let tokenExpiryTime = null;

const formatVirtualNumber = (number, includeExpiry = false, expiryDate = null) => {
  const formatted = {
    number,
    virtualNumber: number,
    subscriptionId: number,
    msisdn: number,
  };
  if (includeExpiry && expiryDate) {
    formatted.expiryDate = expiryDate;
  }
  return formatted;
};

const getTelstraAccessToken = async () => {
  if (accessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return accessToken;
  }

  log.info('Fetching new Telstra API access token');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.TELSTRA_CLIENT_ID,
    client_secret: process.env.TELSTRA_CLIENT_SECRET,
    scope: TELSTRA_API_SCOPES,
  });

  const response = await fetch(TELSTRA_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    accessToken = null;
    tokenExpiryTime = null;
    throw new Error('Failed to authenticate with Telstra API');
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiryTime = Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000;

  log.info('Successfully obtained Telstra API access token');
  return accessToken;
};

const callTelstraApi = async (method, endpoint, body = null, params = null) => {
  const token = await getTelstraAccessToken();

  let url = `${TELSTRA_API_BASE_URL}${endpoint}`;
  if (params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  const options = {
    method: method.toUpperCase(),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Language': 'en-au',
    },
  };

  if (body && method.toUpperCase() !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`Telstra API error: ${response.status}`);
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      error.data = null;
    }
    throw error;
  }

  return response.json();
};

const fetchAllVirtualNumbers = async () => {
  try {
    const data = await callTelstraApi('GET', '/virtual-numbers');
    if (data && data.virtualNumbers && data.virtualNumbers.length > 0) {
      return data.virtualNumbers;
    }
    return [];
  } catch (error) {
    log.error('Failed to fetch virtual numbers', error);
    throw error;
  }
};

const ALLOWED_METHODS_BY_PATH = {
  'leaseNumber': ['POST', 'DELETE'],
  'number': ['POST', 'DELETE'],
  'change-number': ['POST'],
  'current-number': ['GET'],
  'virtual-numbers': ['GET'],
  'messages': ['GET'],
};

const getAllowedMethodsForPath = (routePath) => ALLOWED_METHODS_BY_PATH[routePath] || [];

const getHttpMethod = (event) =>
  event.httpMethod || event.requestContext?.http?.method || event.requestContext?.httpMethod;

module.exports.api = async (event) => {
  const requestOrigin = getRequestOrigin(event);
  const httpMethod = getHttpMethod(event);
  const routePath = event.pathParameters?.proxy || '';

  log.info('API request', { method: httpMethod, path: routePath });

  if (!httpMethod) {
    log.error('HTTP method undefined');
    return createErrorResponse(400, 'HTTP method is required', requestOrigin);
  }

  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getResponseHeaders(requestOrigin),
      body: '',
    };
  }

  try {
    switch (routePath) {
      case 'leaseNumber':
      case 'number':
        if (httpMethod === 'POST') return await module.exports.leaseNumber(event);
        if (httpMethod === 'DELETE') return await module.exports.releaseNumber(event);
        break;
      case 'current-number':
        if (httpMethod === 'GET') return await module.exports.getNumber(event);
        break;
      case 'virtual-numbers':
        if (httpMethod === 'GET') return await module.exports.getAllVirtualNumbers(event);
        break;
      case 'messages':
        if (httpMethod === 'GET') return await module.exports.getMessages(event);
        break;
      default:
        return createErrorResponse(404, `Route not found: ${httpMethod} /api/${routePath}`, requestOrigin);
    }

    return createResponse(405, {
      message: `Method ${httpMethod} not allowed for /api/${routePath}`,
      allowedMethods: getAllowedMethodsForPath(routePath),
    }, requestOrigin);

  } catch (error) {
    log.error('API routing error', error);
    return createErrorResponse(500, 'Internal server error', requestOrigin);
  }
};

module.exports.leaseNumber = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  try {
    log.info('Checking for existing virtual numbers');

    let existingNumbers = [];
    try {
      existingNumbers = await fetchAllVirtualNumbers();
      log.info(`Found ${existingNumbers.length} existing virtual numbers`);
    } catch (error) {
      log.warn('Error checking existing virtual numbers', error);
    }

    const allExistingNumbers = existingNumbers.map((vn) => vn.virtualNumber);

    if (allExistingNumbers.length >= MAX_LEASED_NUMBER_COUNT) {
      log.info(`Already have ${allExistingNumbers.length} numbers (max: ${MAX_LEASED_NUMBER_COUNT})`);
      return createResponse(200, {
        message: `Already have ${allExistingNumbers.length} virtual numbers (max: ${MAX_LEASED_NUMBER_COUNT})`,
        virtualNumbers: allExistingNumbers.map((n) => formatVirtualNumber(n)),
        leasedCount: allExistingNumbers.length,
        maxCount: MAX_LEASED_NUMBER_COUNT,
      }, requestOrigin);
    }

    const numbersToLease = MAX_LEASED_NUMBER_COUNT - allExistingNumbers.length;
    const newSubscriptions = [];

    log.info(`Leasing ${numbersToLease} new numbers`);

    for (let i = 0; i < numbersToLease; i++) {
      try {
        const data = await callTelstraApi('POST', '/virtual-numbers', {});
        if (data.virtualNumber) {
          newSubscriptions.push(data.virtualNumber);
        }
      } catch (leaseError) {
        log.error(`Error leasing number ${i + 1}`, leaseError);
      }
    }

    const allNumbers = [...allExistingNumbers, ...newSubscriptions];

    return createResponse(200, {
      message: `Successfully leased ${newSubscriptions.length} new virtual numbers`,
      virtualNumbers: allNumbers.map((n) => formatVirtualNumber(n)),
      leasedCount: allNumbers.length,
      maxCount: MAX_LEASED_NUMBER_COUNT,
    }, requestOrigin);

  } catch (error) {
    log.error('Error leasing numbers', error);
    return createErrorResponse(500, 'Failed to lease numbers', requestOrigin);
  }
};

module.exports.releaseNumber = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  let requestBody = {};
  if (event.body) {
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'Invalid JSON in request body', requestOrigin);
    }
  }

  const numberToRelease = requestBody.number || requestBody.virtualNumber || requestBody.phoneNumber;

  if (event.body && !numberToRelease) {
    return createErrorResponse(400, 'Missing virtual number to release', requestOrigin);
  }

  let existingNumbers;
  try {
    existingNumbers = await fetchAllVirtualNumbers();
  } catch (error) {
    log.error('Failed to fetch current numbers', error);
    return createErrorResponse(500, 'Failed to verify current numbers', requestOrigin);
  }

  const numberExists = existingNumbers.some((vn) => vn.virtualNumber === numberToRelease);

  if (!numberExists) {
    if (existingNumbers.length === 0) {
      return createErrorResponse(404, 'No active numbers found to release', requestOrigin);
    }
    return createErrorResponse(400, 'Requested number does not match any current leased numbers', requestOrigin);
  }

  try {
    await callTelstraApi('DELETE', `/virtual-numbers/${encodeURIComponent(numberToRelease)}`);
    return createResponse(200, { message: `Number ${numberToRelease} released successfully` }, requestOrigin);
  } catch (error) {
    if (error.status === 404) {
      return createResponse(200, { message: 'Number was already released or not found' }, requestOrigin);
    }
    log.error('Error releasing number', error);
    return createErrorResponse(500, 'Failed to release number', requestOrigin);
  }
};

module.exports.getNumber = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  try {
    const virtualNumbers = await fetchAllVirtualNumbers();

    if (virtualNumbers.length > 0) {
      return createResponse(200, {
        virtualNumbers: virtualNumbers.map((vn) => formatVirtualNumber(vn.virtualNumber)),
        maxCount: MAX_LEASED_NUMBER_COUNT,
      }, requestOrigin);
    }

    return createErrorResponse(404, 'No active numbers leased', requestOrigin);

  } catch (error) {
    log.error('Error fetching active numbers', error);
    return createErrorResponse(500, 'Failed to check for active numbers', requestOrigin);
  }
};

module.exports.getAllVirtualNumbers = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  try {
    const virtualNumbers = await fetchAllVirtualNumbers();

    return createResponse(200, {
      virtualNumbers: virtualNumbers.map((vn) =>
        formatVirtualNumber(vn.virtualNumber, true, vn.expiryDate),
      ),
      maxCount: MAX_LEASED_NUMBER_COUNT,
    }, requestOrigin);

  } catch (error) {
    log.error('Error fetching virtual numbers', error);
    return createResponse(200, { virtualNumbers: [], maxCount: MAX_LEASED_NUMBER_COUNT }, requestOrigin);
  }
};

module.exports.getMessages = async (event) => {
  const requestOrigin = getRequestOrigin(event);

  let virtualNumbers = [];
  try {
    virtualNumbers = await fetchAllVirtualNumbers();
  } catch (error) {
    log.error('Failed to fetch virtual numbers for messages', error);
  }

  if (virtualNumbers.length === 0) {
    return createErrorResponse(404, 'No active numbers to fetch messages for. Try leasing a number first.', requestOrigin);
  }

  try {
    log.info('Fetching messages');
    const data = await callTelstraApi('GET', '/messages', null, { limit: MESSAGES_FETCH_LIMIT });

    const messages = data.messages || [];
    log.info(`Found ${messages.length} messages`);

    const formattedMessages = messages
      .map((msg) => ({
        from: msg.from || msg.sourceNumber,
        body: msg.messageContent || msg.body,
        to: msg.to || msg.destinationNumber,
        receivedAt: msg.receivedTimestamp || msg.createTimestamp || msg.timestamp,
      }))
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    return createResponse(200, {
      messages: formattedMessages,
      activeNumbers: virtualNumbers.map((vn) => vn.virtualNumber),
    }, requestOrigin);

  } catch (error) {
    log.error('Error fetching messages', error);
    return createErrorResponse(500, 'Failed to fetch messages', requestOrigin);
  }
};

module.exports.serveFrontend = serveFrontend;
module.exports.getAllMessages = module.exports.getMessages;
module.exports._sanitizeLogData = sanitizeLogData;
