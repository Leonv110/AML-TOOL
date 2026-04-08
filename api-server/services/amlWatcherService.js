// api-server/services/amlWatcherService.js

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
        const options = {
            method,
            headers: {
                // For most APIs, this is either passing the API key directly via a custom header:
                'Api-Key': apiKey,
                // OR via Authorization header (Adjust based on AML watcher's doc for actual requests e.g., 'Bearer <API_KEY>')
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };

        if (payload && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(payload);
        }

        const response = await fetch(`https://api.amlwatcher.com${path}`, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AML request failed at ${path}: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`❌ AML Request Error (${endpoint}):`, error.message);
        throw error;
    }
};

module.exports = {
    amlWatcherRequest
};
