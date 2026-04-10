// api-server/services/amlWatcherService.js
const axios = require('axios');

/**
 * Request wrapper for AML Watcher API using the permanent API Key.
 * 
 * @param {string} endpoint - API endpoint path (e.g., '/api/v1/search')
 * @param {object} payload - Body of the request
 * @param {string} method - HTTP Method (default: 'POST')
 */
const amlWatcherRequest = async (endpoint, payload = null, method = 'POST') => {
    // Ensure the endpoint has a leading slash
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const apiKey = process.env.AMLWATCHER_API_KEY;
    if (!apiKey) {
        throw new Error("Missing AMLWATCHER_API_KEY in .env file");
    }

    try {
        const url = `https://api.amlwatcher.com${path}`;
        const config = {
            method: method.toLowerCase(),
            url,
            headers: {
                'Api-Key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            data: payload
        };

        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`❌ AML API Error (${endpoint}): ${error.response.status}`, error.response.data);
            throw new Error(`AML request failed at ${path}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        console.error(`❌ AML Request Error (${endpoint}):`, error.message);
        throw error;
    }
};

module.exports = {
    amlWatcherRequest
};
