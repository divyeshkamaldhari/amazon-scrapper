/**
 * Error Handler Service
 * Centralized error detection and recovery strategies
 */

const config = require('../config');

// Error types
const ERROR_TYPES = {
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CAPTCHA: 'CAPTCHA',
  BLOCKED: 'BLOCKED',
  NETWORK: 'NETWORK',
  PARSE: 'PARSE',
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN: 'UNKNOWN'
};

// Retry strategies
const RETRY_STRATEGIES = {
  [ERROR_TYPES.RATE_LIMITED]: {
    maxRetries: 3,
    baseDelay: 30000, // 30 seconds
    multiplier: 2,
    maxDelay: 300000 // 5 minutes
  },
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: {
    maxRetries: 3,
    baseDelay: 10000, // 10 seconds
    multiplier: 2,
    maxDelay: 60000 // 1 minute
  },
  [ERROR_TYPES.NETWORK]: {
    maxRetries: 3,
    baseDelay: 5000, // 5 seconds
    multiplier: 2,
    maxDelay: 30000 // 30 seconds
  },
  [ERROR_TYPES.CAPTCHA]: {
    maxRetries: 1,
    baseDelay: config.captchaPauseMin || 1800000, // 30 minutes
    multiplier: 1,
    maxDelay: config.captchaPauseMax || 3600000 // 60 minutes
  }
};

/**
 * Detect error type from HTTP response or error object
 * @param {Object} response - HTTP response or error
 * @returns {string} Error type
 */
function detectErrorType(response) {
  // Check status code
  if (response.status === 429) {
    return ERROR_TYPES.RATE_LIMITED;
  }

  if (response.status === 503) {
    return ERROR_TYPES.SERVICE_UNAVAILABLE;
  }

  if (response.status === 404) {
    return ERROR_TYPES.NOT_FOUND;
  }

  // Check response body for CAPTCHA
  if (response.data && typeof response.data === 'string') {
    if (isCaptchaResponse(response.data)) {
      return ERROR_TYPES.CAPTCHA;
    }

    if (isBlockedResponse(response.data)) {
      return ERROR_TYPES.BLOCKED;
    }
  }

  // Check for network errors
  if (response.code === 'ECONNREFUSED' ||
      response.code === 'ETIMEDOUT' ||
      response.code === 'ENOTFOUND' ||
      response.code === 'ECONNRESET') {
    return ERROR_TYPES.NETWORK;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Check if response is a CAPTCHA page
 * @param {string} html - Response HTML
 * @returns {boolean}
 */
function isCaptchaResponse(html) {
  const captchaIndicators = [
    'Type the characters you see in this image',
    'Enter the characters you see below',
    'Sorry, we just need to make sure you\'re not a robot',
    'api-services-support@amazon.com',
    'To discuss automated access to Amazon data',
    '/captcha/',
    'captcha-delivery'
  ];

  return captchaIndicators.some(indicator =>
    html.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Check if response indicates blocked access
 * @param {string} html - Response HTML
 * @returns {boolean}
 */
function isBlockedResponse(html) {
  const blockedIndicators = [
    'Your request has been blocked',
    'Access Denied',
    'Request blocked',
    'automated access',
    'unusual traffic'
  ];

  return blockedIndicators.some(indicator =>
    html.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Calculate retry delay with exponential backoff
 * @param {string} errorType - Error type
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(errorType, attempt) {
  const strategy = RETRY_STRATEGIES[errorType];

  if (!strategy) {
    return 5000; // Default 5 second delay
  }

  const delay = strategy.baseDelay * Math.pow(strategy.multiplier, attempt);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter

  return Math.min(delay + jitter, strategy.maxDelay);
}

/**
 * Check if error is retryable
 * @param {string} errorType - Error type
 * @param {number} attempt - Current attempt number
 * @returns {boolean}
 */
function isRetryable(errorType, attempt) {
  const strategy = RETRY_STRATEGIES[errorType];

  if (!strategy) {
    return false;
  }

  return attempt < strategy.maxRetries;
}

/**
 * Handle scraping error with appropriate strategy
 * @param {Object} error - Error object
 * @param {number} attempt - Current attempt
 * @returns {Object} - { shouldRetry, delay, errorType, message }
 */
function handleScrapingError(error, attempt = 0) {
  const errorType = detectErrorType(error);
  const shouldRetry = isRetryable(errorType, attempt);
  const delay = shouldRetry ? calculateRetryDelay(errorType, attempt) : 0;

  let message = '';
  let action = 'FAIL';

  switch (errorType) {
    case ERROR_TYPES.RATE_LIMITED:
      message = 'Rate limited by Amazon. Will retry with backoff.';
      action = shouldRetry ? 'RETRY' : 'PAUSE_JOB';
      break;

    case ERROR_TYPES.SERVICE_UNAVAILABLE:
      message = 'Amazon service temporarily unavailable.';
      action = shouldRetry ? 'RETRY' : 'FAIL';
      break;

    case ERROR_TYPES.CAPTCHA:
      message = 'CAPTCHA detected. Pausing job for extended period.';
      action = 'PAUSE_JOB';
      break;

    case ERROR_TYPES.BLOCKED:
      message = 'Access blocked by Amazon.';
      action = 'PAUSE_JOB';
      break;

    case ERROR_TYPES.NETWORK:
      message = 'Network error occurred.';
      action = shouldRetry ? 'RETRY' : 'FAIL';
      break;

    case ERROR_TYPES.NOT_FOUND:
      message = 'Page not found.';
      action = 'SKIP';
      break;

    default:
      message = error.message || 'Unknown error occurred.';
      action = 'FAIL';
  }

  return {
    shouldRetry,
    delay,
    errorType,
    message,
    action,
    attempt: attempt + 1
  };
}

/**
 * Create a structured error log entry
 * @param {Object} params - Error parameters
 * @returns {Object} Structured error log
 */
function createErrorLog(params) {
  const { jobId, upc, rowId, errorType, message, attempt, action } = params;

  return {
    timestamp: new Date().toISOString(),
    jobId,
    upc,
    rowId,
    errorType,
    message,
    attempt,
    action,
    recoverable: action !== 'FAIL'
  };
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result or throws after max retries
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 5000,
    multiplier = 2,
    maxDelay = 60000,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay);
        const jitter = Math.random() * 1000;

        if (onRetry) {
          onRetry(attempt + 1, delay, error);
        }

        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}

module.exports = {
  ERROR_TYPES,
  RETRY_STRATEGIES,
  detectErrorType,
  isCaptchaResponse,
  isBlockedResponse,
  calculateRetryDelay,
  isRetryable,
  handleScrapingError,
  createErrorLog,
  retryWithBackoff,
  sleep
};
