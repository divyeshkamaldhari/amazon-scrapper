const fs = require('fs');
const path = require('path');
const config = require('../config');

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (can be set via env)
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

// Log directory
const logDir = path.join(config.storagePath, 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Get current date string for log file name
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format log message
 */
function formatMessage(level, context, message, data = null) {
  const timestamp = getTimestamp();
  const contextStr = context ? `[${context}]` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';

  return `${timestamp} [${level}] ${contextStr} ${message}${dataStr}`;
}

/**
 * Write to log file
 */
function writeToFile(formattedMessage) {
  const logFile = path.join(logDir, `app-${getDateString()}.log`);

  fs.appendFileSync(logFile, formattedMessage + '\n', { flag: 'a' });
}

/**
 * Write to job-specific log file
 */
function writeToJobFile(jobId, formattedMessage) {
  const jobLogDir = path.join(config.resultsPath, jobId);

  if (!fs.existsSync(jobLogDir)) {
    fs.mkdirSync(jobLogDir, { recursive: true });
  }

  const logFile = path.join(jobLogDir, 'job.log');
  fs.appendFileSync(logFile, formattedMessage + '\n', { flag: 'a' });
}

/**
 * Base log function
 */
function log(level, levelName, context, message, data = null, jobId = null) {
  if (level < currentLevel) return;

  const formattedMessage = formatMessage(levelName, context, message, data);

  // Console output with colors
  const colors = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m'  // Red
  };
  const reset = '\x1b[0m';

  console.log(`${colors[levelName]}${formattedMessage}${reset}`);

  // Write to main log file
  writeToFile(formattedMessage);

  // Write to job-specific log if jobId provided
  if (jobId) {
    writeToJobFile(jobId, formattedMessage);
  }
}

/**
 * Logger instance with context
 */
class Logger {
  constructor(context = null, jobId = null) {
    this.context = context;
    this.jobId = jobId;
  }

  setJobId(jobId) {
    this.jobId = jobId;
    return this;
  }

  debug(message, data = null) {
    log(LOG_LEVELS.DEBUG, 'DEBUG', this.context, message, data, this.jobId);
  }

  info(message, data = null) {
    log(LOG_LEVELS.INFO, 'INFO', this.context, message, data, this.jobId);
  }

  warn(message, data = null) {
    log(LOG_LEVELS.WARN, 'WARN', this.context, message, data, this.jobId);
  }

  error(message, data = null) {
    log(LOG_LEVELS.ERROR, 'ERROR', this.context, message, data, this.jobId);
  }

  // Log HTTP request
  httpRequest(method, url, status, duration) {
    this.info(`${method} ${url} - ${status} (${duration}ms)`);
  }

  // Log job state transition
  jobStateChange(jobId, fromState, toState) {
    this.info(`Job state change: ${fromState} -> ${toState}`, { jobId });
  }

  // Log UPC processing
  upcProcessed(jobId, upc, status, duration) {
    this.info(`UPC processed: ${upc} - ${status} (${duration}ms)`, { jobId });
  }

  // Log scraping result
  scrapingResult(jobId, upc, asinCount, brandMatch, upcMatch) {
    this.info(`Scraping result for ${upc}: ${asinCount} ASINs, brandMatch=${brandMatch}, upcMatch=${upcMatch}`, { jobId });
  }

  // Log error with stack trace
  errorWithStack(message, error) {
    this.error(message, {
      message: error.message,
      stack: error.stack
    });
  }
}

/**
 * Create a logger with context
 */
function createLogger(context, jobId = null) {
  return new Logger(context, jobId);
}

/**
 * Default logger instance
 */
const defaultLogger = new Logger();

/**
 * Get log file path for a date
 */
function getLogFilePath(date = null) {
  const dateStr = date || getDateString();
  return path.join(logDir, `app-${dateStr}.log`);
}

/**
 * Get job log file path
 */
function getJobLogFilePath(jobId) {
  return path.join(config.resultsPath, jobId, 'job.log');
}

/**
 * Read log file contents
 */
function readLogFile(filePath, lines = 100) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const allLines = content.split('\n').filter(line => line.trim());

  // Return last N lines
  return allLines.slice(-lines);
}

/**
 * Clean old log files (older than N days)
 */
function cleanOldLogs(daysToKeep = 7) {
  const files = fs.readdirSync(logDir);
  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  files.forEach(file => {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`[LOGGER] Deleted old log file: ${file}`);
    }
  });
}

module.exports = {
  LOG_LEVELS,
  Logger,
  createLogger,
  defaultLogger,
  getLogFilePath,
  getJobLogFilePath,
  readLogFile,
  cleanOldLogs,

  // Convenience methods on default logger
  debug: (message, data) => defaultLogger.debug(message, data),
  info: (message, data) => defaultLogger.info(message, data),
  warn: (message, data) => defaultLogger.warn(message, data),
  error: (message, data) => defaultLogger.error(message, data)
};
