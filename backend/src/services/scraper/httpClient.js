const axios = require('axios');
const config = require('../../config');

// Browser-like headers to avoid detection
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

// Create axios instance
const httpClient = axios.create({
  timeout: 30000,
  headers: DEFAULT_HEADERS,
  maxRedirects: 5,
  validateStatus: (status) => status < 500
});

/**
 * Make a GET request with retry logic
 * @param {string} url - URL to fetch
 * @param {number} retries - Number of retries (default from config)
 * @returns {Promise<{success: boolean, data: string|null, status: number, error: string|null}>}
 */
async function fetchPage(url, retries = config.maxRetries) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[HTTP] Fetching: ${url} (attempt ${attempt + 1})`);

      const response = await httpClient.get(url);

      // Check for rate limiting
      if (response.status === 429) {
        console.warn(`[HTTP] Rate limited (429) on attempt ${attempt + 1}`);
        lastError = 'Rate limited (429)';

        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt) * 5000; // Exponential backoff
          console.log(`[HTTP] Backing off for ${backoffDelay}ms`);
          await sleep(backoffDelay);
          continue;
        }

        return {
          success: false,
          data: null,
          status: 429,
          error: 'Rate limited after retries'
        };
      }

      // Check for service unavailable
      if (response.status === 503) {
        console.warn(`[HTTP] Service unavailable (503) on attempt ${attempt + 1}`);
        lastError = 'Service unavailable (503)';

        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt) * 3000;
          await sleep(backoffDelay);
          continue;
        }

        return {
          success: false,
          data: null,
          status: 503,
          error: 'Service unavailable after retries'
        };
      }

      // Check for CAPTCHA
      if (response.data && isCaptchaPage(response.data)) {
        console.warn(`[HTTP] CAPTCHA detected on attempt ${attempt + 1}`);
        return {
          success: false,
          data: null,
          status: response.status,
          error: 'CAPTCHA_DETECTED'
        };
      }

      // Success
      if (response.status === 200) {
        return {
          success: true,
          data: response.data,
          status: 200,
          error: null
        };
      }

      // Other status codes
      return {
        success: false,
        data: response.data,
        status: response.status,
        error: `HTTP ${response.status}`
      };

    } catch (error) {
      lastError = error.message;
      console.error(`[HTTP] Error on attempt ${attempt + 1}: ${error.message}`);

      if (attempt < retries) {
        const backoffDelay = Math.pow(2, attempt) * 2000;
        await sleep(backoffDelay);
      }
    }
  }

  return {
    success: false,
    data: null,
    status: 0,
    error: lastError || 'Unknown error'
  };
}

/**
 * Check if the response is a CAPTCHA page
 * @param {string} html - HTML content
 * @returns {boolean}
 */
function isCaptchaPage(html) {
  if (typeof html !== 'string') return false;

  const captchaIndicators = [
    'Type the characters you see in this image',
    'Enter the characters you see below',
    'Sorry, we just need to make sure you\'re not a robot',
    'api-services-support@amazon.com',
    'To discuss automated access to Amazon data'
  ];

  return captchaIndicators.some(indicator => html.includes(indicator));
}

/**
 * Check if the response indicates the page was not found
 * @param {string} html - HTML content
 * @returns {boolean}
 */
function isNotFoundPage(html) {
  if (typeof html !== 'string') return false;

  const notFoundIndicators = [
    'Page Not Found',
    'We\'re sorry. The Web address you entered is not a functioning page',
    'ASIN not found',
    'The page you requested cannot be found'
  ];

  return notFoundIndicators.some(indicator => html.includes(indicator));
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  fetchPage,
  isCaptchaPage,
  isNotFoundPage,
  httpClient
};
