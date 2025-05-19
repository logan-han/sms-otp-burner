const axios = require('axios');

const TELSTRA_API_BASE_URL = 'https://products.api.telstra.com/messaging/v3';
const TELSTRA_AUTH_URL = 'https://products.api.telstra.com/v2/oauth/token';

const MAX_LEASED_NUMBER_COUNT = parseInt(process.env.MAX_LEASED_NUMBER_COUNT) || 1;

let accessToken = null;
let tokenExpiryTime = null;
let currentSubscriptions = [];

const getTelstraAccessToken = async () => {
  if (accessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return accessToken;
  }

  try {
    console.log('Fetching new Telstra API access token...');
    const response = await axios.post(TELSTRA_AUTH_URL, 
      `grant_type=client_credentials&client_id=${process.env.TELSTRA_CLIENT_ID}&client_secret=${process.env.TELSTRA_CLIENT_SECRET}&scope=free-trial-numbers:read free-trial-numbers:write messages:read messages:write virtual-numbers:read virtual-numbers:write reports:read reports:write`, 
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    accessToken = response.data.access_token;
    tokenExpiryTime = Date.now() + (response.data.expires_in - 60) * 1000; 
    console.log('Successfully fetched new Telstra API access token.');
    return accessToken;
  } catch (error) {
    console.error('Error fetching Telstra API access token:', error.response ? error.response.data : error.message);
    accessToken = null;
    tokenExpiryTime = null;
    throw new Error('Failed to authenticate with Telstra API.');
  }
};

const callTelstraApi = async (config) => {
  const token = await getTelstraAccessToken();
  config.headers = {
    ...config.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Content-Language': 'en-au'
  };
  return axios(config);
};

const getAllowedMethodsForPath = (path) => {
    switch (path) {
        case 'leaseNumber':
        case 'number':
            return ['POST', 'DELETE'];
        case 'change-number':
            return ['POST'];
        case 'current-number':
            return ['GET'];
        case 'virtual-numbers':
            return ['GET'];
        case 'messages':
            return ['GET'];
        default:
            return [];
    }
};

module.exports.api = async (event) => {
    console.log('API Handler - Event received:', JSON.stringify(event, null, 2));
    
    let httpMethod = event.httpMethod || event.requestContext?.http?.method || event.requestContext?.httpMethod;
    const pathParameters = event.pathParameters || {};
    const path = pathParameters?.proxy || '';
    
    console.log('API Handler - Parsed:', { httpMethod, path, pathParameters });
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    if (!httpMethod) {
        console.error('HTTP method is undefined in event:', JSON.stringify(event, null, 2));
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
                message: 'HTTP method is required but was undefined',
                eventKeys: Object.keys(event),
                requestContext: event.requestContext
            })
        };
    }

    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        switch (path) {
            case 'leaseNumber':
            case 'number':
                if (httpMethod === 'POST') {
                    return await module.exports.leaseNumber(event);
                } else if (httpMethod === 'DELETE') {
                    return await module.exports.releaseNumber(event);
                }
                break;
            case 'current-number':
                if (httpMethod === 'GET') {
                    return await module.exports.getNumber(event);
                }
                break;
            case 'virtual-numbers':
                if (httpMethod === 'GET') {
                    return await module.exports.getAllVirtualNumbers(event);
                }
                break;
            case 'messages':
                if (httpMethod === 'GET') {
                    return await module.exports.getMessages(event);
                }
                break;
            default:
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: `Route not found: ${httpMethod} /api/${path}` })
                };
        }
        
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ 
                message: `Method ${httpMethod} not allowed for /api/${path}`,
                allowedMethods: getAllowedMethodsForPath(path)
            })
        };
        
    } catch (error) {
        console.error('API routing error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Internal server error', error: error.message })
        };
    }
};

module.exports.leaseNumber = async (event) => {
    try {
        console.log('Checking for existing virtual numbers via API...');
        let allExistingNumbers = [];
        try {
            const existingNumbersResponse = await callTelstraApi({
                method: 'get',
                url: `${TELSTRA_API_BASE_URL}/virtual-numbers`
            });

            if (existingNumbersResponse.data && existingNumbersResponse.data.virtualNumbers && existingNumbersResponse.data.virtualNumbers.length > 0) {
                allExistingNumbers = existingNumbersResponse.data.virtualNumbers.map(vn => vn.virtualNumber);
                console.log(`Found ${allExistingNumbers.length} existing virtual numbers`);
            } else {
                console.log('No virtual numbers found in API response');
            }
        } catch (checkError) {
            console.warn('Error checking existing virtual numbers:', checkError.response ? checkError.response.data : checkError.message);
        }

        currentSubscriptions = allExistingNumbers;

        if (allExistingNumbers.length >= MAX_LEASED_NUMBER_COUNT) {
            console.log(`Already have ${allExistingNumbers.length} numbers (max: ${MAX_LEASED_NUMBER_COUNT}). Not leasing more.`);
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    message: `Already have ${allExistingNumbers.length} virtual numbers (max: ${MAX_LEASED_NUMBER_COUNT}). Not leasing additional numbers.`, 
                    virtualNumbers: allExistingNumbers.map(number => ({
                        number: number,
                        virtualNumber: number,
                        subscriptionId: number
                    })),
                    leasedCount: allExistingNumbers.length,
                    maxCount: MAX_LEASED_NUMBER_COUNT
                }),
            };
        }

        const numbersToLease = MAX_LEASED_NUMBER_COUNT - allExistingNumbers.length;
        const newSubscriptions = [];

        console.log(`Need to lease ${numbersToLease} more numbers to reach max of ${MAX_LEASED_NUMBER_COUNT}`);

        const remainingToLease = numbersToLease;
        for (let i = 0; i < remainingToLease; i++) {
            try {
                const subscriptionUrl = `${TELSTRA_API_BASE_URL}/virtual-numbers`;
                console.log(`Leasing new number ${i + 1}/${remainingToLease}:`, subscriptionUrl);
                const response = await callTelstraApi({
                    method: 'post',
                    url: subscriptionUrl,
                    data: {}
                });
                
                const leasedNumber = response.data.virtualNumber;

                newSubscriptions.push(leasedNumber);
            } catch (leaseError) {
                console.error(`Error leasing number ${i + 1}:`, leaseError.response ? leaseError.response.data : leaseError.message);
            }
        }

        currentSubscriptions = [...allExistingNumbers, ...newSubscriptions];

        const allNumbers = currentSubscriptions.map(number => ({
            number: number,
            virtualNumber: number,
            subscriptionId: number
        }));

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                message: `Successfully leased ${newSubscriptions.length} new virtual numbers`, 
                virtualNumbers: allNumbers,
                leasedCount: currentSubscriptions.length,
                maxCount: MAX_LEASED_NUMBER_COUNT
            }),
        };
    } catch (error) {
        console.error('Error leasing numbers:', error.response ? error.response.data : error.message);
        return {
            statusCode: error.response ? error.response.status : 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Failed to lease numbers', error: error.response ? error.response.data : error.message }),
        };
    }
};

module.exports.releaseNumber = async (event) => {
    let requestBody = {};
    if (event.body) {
        try {
            requestBody = JSON.parse(event.body);
        } catch (error) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Invalid JSON in request body' }),
            };
        }
    }

    if (event.body && (!requestBody.number && !requestBody.phoneNumber && !requestBody.virtualNumber)) {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Missing virtual number to release' }),
        };
    }

    const numberToRelease = requestBody.number || requestBody.virtualNumber || requestBody.phoneNumber;
    const subscriptionIndex = currentSubscriptions.findIndex(number => number === numberToRelease);
    
    if (subscriptionIndex !== -1) {
        try {
            await callTelstraApi({
                method: 'delete',
                url: `${TELSTRA_API_BASE_URL}/virtual-numbers/${encodeURIComponent(numberToRelease)}`
            });

            const releasedNumber = currentSubscriptions[subscriptionIndex];
            currentSubscriptions.splice(subscriptionIndex, 1);

            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: `Number ${releasedNumber} released successfully` }),
            };
        } catch (error) {
            console.error('Error releasing number:', error.response ? error.response.data : error.message);
            if (error.response && error.response.status === 404) {
                currentSubscriptions.splice(subscriptionIndex, 1);
                 return {
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ message: 'Number was already released or not found with Telstra.' }),
                };
            }
            return {
                statusCode: error.response ? error.response.status : 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: 'Failed to release number', error: error.response ? error.response.data : error.message }),
            };
        }
    } else if (currentSubscriptions.length === 0) {
        return {
            statusCode: 404,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'No active numbers found to release for this session' }),
        };
    } else {
        return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Requested number does not match any current leased numbers' }),
        };
    }
};

module.exports.getNumber = async (event) => {
    try {
        const response = await callTelstraApi({
            method: 'get',
            url: `${TELSTRA_API_BASE_URL}/virtual-numbers` 
        });
        
        if (response.data && response.data.virtualNumbers && response.data.virtualNumbers.length > 0) {
            const foundSubscriptions = response.data.virtualNumbers.map(vn => vn.virtualNumber);
            
            currentSubscriptions = foundSubscriptions;
            
            if (foundSubscriptions.length > 0) {
                return {
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({
                        virtualNumbers: foundSubscriptions.map(number => ({
                            number: number,
                            virtualNumber: number,
                            subscriptionId: number
                        }))
                    }),
                };
            }
        }
        
        currentSubscriptions = [];
        
        return {
            statusCode: 404,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'No active numbers leased' }),
        };

    } catch (error) {
        console.error('Error fetching active numbers from Telstra:', error.response ? error.response.data : error.message);
        
        const activeSubscriptions = currentSubscriptions.filter(number => number);
        
        if (activeSubscriptions.length > 0) {
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    virtualNumbers: activeSubscriptions.map(number => ({
                        number: number,
                        virtualNumber: number,
                        subscriptionId: number
                    }))
                }),
            };
        }
        
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Failed to check for active numbers with Telstra', error: error.message }),
        };
    }
};

module.exports.getMessages = async (event) => {
    const activeSubscriptions = currentSubscriptions.filter(number => number);

    if (activeSubscriptions.length === 0) {
        return {
            statusCode: 404,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'No active numbers to fetch messages for. Try leasing a number first.' }),
        };
    }

    try {
        console.log('Fetching all messages for account...');
        const response = await callTelstraApi({ 
            method: 'get',
            url: `${TELSTRA_API_BASE_URL}/messages`,
            params: {
                limit: 50
            }
        });

        console.log('Telstra API messages response:', JSON.stringify(response.data, null, 2));
        const messages = response.data.messages || [];
        console.log('Extracted messages:', messages.length, 'messages found');
        
        const formattedMessages = messages.map(msg => ({ 
            from: msg.from || msg.sourceNumber,
            body: msg.messageContent || msg.body,
            to: msg.to || msg.destinationNumber,
            receivedAt: msg.receivedTimestamp || msg.createTimestamp || msg.timestamp
        }));

        formattedMessages.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

        console.log('Formatted messages:', formattedMessages.length, 'messages found');

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                messages: formattedMessages,
                activeNumbers: activeSubscriptions
            }),
        };
    } catch (error) {
        console.error('Error fetching messages:', error.response ? error.response.data : error.message);
        return {
            statusCode: error.response ? error.response.status : 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Failed to fetch messages', error: error.response ? error.response.data : error.message }),
        };
    }
};

module.exports.serveFrontend = async (event) => {
    const fs = require('fs');
    const path = require('path');
    const mime = require('mime-types');

    console.log('Frontend handler - Event received:', JSON.stringify(event, null, 2));

    let requestedPath = event.pathParameters && event.pathParameters.proxy ? event.pathParameters.proxy : 'index.html';
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

    console.log('Frontend handler - Requested path:', requestedPath);

    const buildDir = path.resolve(__dirname, '..', 'build');
    const filePath = path.resolve(buildDir, requestedPath);
    console.log('Frontend handler - File path:', filePath);

    if (!filePath.startsWith(buildDir)) {
        console.error('Frontend handler - Attempted access outside build directory:', filePath);
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
            body: '<html><body><h1>403 Forbidden</h1><p>Access denied.</p></body></html>',
        };
    }

    try {
        if (fs.existsSync(filePath)) {
            const contentType = mime.lookup(filePath) || 'application/octet-stream';
            
            console.log('Frontend handler - Serving file:', filePath, 'Content-Type:', contentType);

            const isTextFile = contentType.startsWith('text/') || 
                              contentType.includes('javascript') || 
                              contentType.includes('json') || 
                              contentType.includes('css') ||
                              contentType.includes('html');

            if (isTextFile) {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                return {
                    statusCode: 200,
                    headers: { 
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: fileContent,
                    isBase64Encoded: false
                };
            } else {
                const fileContent = fs.readFileSync(filePath);
                return {
                    statusCode: 200,
                    headers: { 
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: fileContent.toString('base64'),
                    isBase64Encoded: true
                };
            }
        } else {
            console.log('Frontend handler - File not found:', filePath, 'serving index.html for SPA routing');
            
            const indexPath = path.resolve(__dirname, '..', 'build', 'index.html');
            if (fs.existsSync(indexPath)) {
                const indexContent = fs.readFileSync(indexPath, 'utf-8');
                return {
                    statusCode: 200,
                    headers: { 
                        'Content-Type': 'text/html',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: indexContent,
                };
            } else {
                const fallbackHtml = `
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><title>App Not Found</title></head>
                <body>
                    <h1>React App Not Found</h1>
                    <p>The frontend (index.html) was not found in the expected location: <code>build/index.html</code>.</p>
                    <p>Please ensure your React app is built (e.g., run <code>yarn build:react</code> in the root directory) and that the files are correctly packaged with your Lambda.</p>
                </body></html>`;
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
                    body: fallbackHtml,
                };
            }
        }
    } catch (error) {
        console.error("Error serving frontend:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' },
            body: '<html><body><h1>Error</h1><p>Could not load the application frontend.</p></body></html>',
        };
    }
};

module.exports.getAllVirtualNumbers = async (event) => {
    try {
        const response = await callTelstraApi({
            method: 'get',
            url: `${TELSTRA_API_BASE_URL}/virtual-numbers` 
        });
        
        if (response.data && response.data.virtualNumbers && response.data.virtualNumbers.length > 0) {
            const foundSubscriptions = response.data.virtualNumbers.map(vn => vn.virtualNumber);
            
            currentSubscriptions = foundSubscriptions;
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    virtualNumbers: foundSubscriptions.map(number => ({
                        number: number,
                        virtualNumber: number,
                        subscriptionId: number,
                        msisdn: number
                    }))
                }),
            };
        } else {
            currentSubscriptions = [];
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ virtualNumbers: [] }),
            };
        }
    } catch (error) {
        console.error('Error fetching virtual numbers from Telstra API:', error.response ? error.response.data : error.message);
        
        const activeSubscriptions = currentSubscriptions.filter(number => number);
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                virtualNumbers: activeSubscriptions.map(number => ({
                    number: number,
                    virtualNumber: number,
                    subscriptionId: number,
                    msisdn: number
                }))
            }),
        };
    }
};

module.exports.getAllMessages = async (event) => {
    return module.exports.getMessages(event);
};
