// api-server/services/amlWatcherService.js
// Proper two-step auth: get access token first, then use Bearer token for searches
const axios = require('axios');

const BASE_URL = 'https://api.amlwatcher.com';

// Cache the access token (valid 3 hours, we refresh every 2.5 hours to be safe)
let cachedToken = null;
let tokenExpiry = 0;
const TOKEN_LIFETIME_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours

/**
 * Step 1: Get access token using email/password credentials.
 * AML Watcher returns a JWT valid for ~3 hours.
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const email = process.env.AMLWATCHER_EMAIL;
  const password = process.env.AMLWATCHER_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing AMLWATCHER_EMAIL or AMLWATCHER_PASSWORD in .env');
  }

  try {
    const response = await axios.post(`${BASE_URL}/api/get-access-token`, {
      email,
      password
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const token = response.data?.data?.access || response.data?.access || response.data?.token;
    if (!token) {
      console.error('AML Watcher token response:', JSON.stringify(response.data));
      throw new Error('No access token in AML Watcher response');
    }

    cachedToken = token;
    tokenExpiry = Date.now() + TOKEN_LIFETIME_MS;
    console.log('✅ AML Watcher access token obtained (valid ~3 hours)');
    return token;
  } catch (error) {
    cachedToken = null;
    tokenExpiry = 0;
    if (error.response) {
      console.error(`❌ AML Watcher auth error: ${error.response.status}`, error.response.data);
      throw new Error(`AML Watcher authentication failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Step 2: Make an authenticated request using the Bearer token.
 * Automatically handles token refresh if expired.
 */
const amlWatcherRequest = async (endpoint, payload = null, method = 'POST') => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const token = await getAccessToken();

  try {
    const url = `${BASE_URL}${path}`;
    const config = {
      method: method.toLowerCase(),
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: payload
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    // If 401/403, token might have expired early — clear cache and retry once
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('⚠️ Token rejected, refreshing...');
      cachedToken = null;
      tokenExpiry = 0;

      const newToken = await getAccessToken();
      const retryConfig = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${path}`,
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json'
        },
        data: payload
      };

      const retryResponse = await axios(retryConfig);
      return retryResponse.data;
    }

    if (error.response) {
      console.error(`❌ AML API Error (${endpoint}): ${error.response.status}`, error.response.data);
      throw new Error(`AML request failed at ${path}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    console.error(`❌ AML Request Error (${endpoint}):`, error.message);
    throw error;
  }
};

module.exports = {
  amlWatcherRequest,
  getAccessToken
};
