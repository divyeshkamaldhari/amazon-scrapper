/**
 * Cleanup Service
 * Handles cleanup of old files and data
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CLEANUP');

/**
 * Clean up old job files
 * @param {number} daysToKeep - Number of days to keep jobs
 * @returns {Object} - Cleanup statistics
 */
function cleanupOldJobs(daysToKeep = 30) {
  logger.info(`Starting job cleanup (keeping last ${daysToKeep} days)`);

  const stats = {
    checked: 0,
    deleted: 0,
    errors: 0,
    freedBytes: 0
  };

  const resultsDir = config.resultsPath;

  if (!fs.existsSync(resultsDir)) {
    return stats;
  }

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  const jobDirs = fs.readdirSync(resultsDir).filter(name => {
    const fullPath = path.join(resultsDir, name);
    return fs.statSync(fullPath).isDirectory() && name.startsWith('JOB_');
  });

  for (const jobDir of jobDirs) {
    stats.checked++;

    try {
      const jobPath = path.join(resultsDir, jobDir);
      const metadataPath = path.join(jobPath, 'metadata.json');

      if (!fs.existsSync(metadataPath)) {
        continue;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // Check if job is completed and old enough
      if (metadata.status === 'COMPLETED' && metadata.completedAt) {
        const completedAt = new Date(metadata.completedAt).getTime();

        if (now - completedAt > maxAge) {
          // Calculate size before deletion
          const size = getDirectorySize(jobPath);
          stats.freedBytes += size;

          // Delete job directory
          fs.rmSync(jobPath, { recursive: true, force: true });

          // Delete associated CSV
          const csvPath = path.join(config.exportsPath, `${jobDir}.csv`);
          if (fs.existsSync(csvPath)) {
            stats.freedBytes += fs.statSync(csvPath).size;
            fs.unlinkSync(csvPath);
          }

          stats.deleted++;
          logger.info(`Deleted old job: ${jobDir}`);
        }
      }
    } catch (error) {
      stats.errors++;
      logger.error(`Error cleaning up job ${jobDir}: ${error.message}`);
    }
  }

  logger.info(`Cleanup complete: ${stats.deleted} jobs deleted, ${formatBytes(stats.freedBytes)} freed`);

  return stats;
}

/**
 * Clean up old upload files
 * @param {number} daysToKeep - Number of days to keep uploads
 */
function cleanupOldUploads(daysToKeep = 7) {
  logger.info(`Starting upload cleanup (keeping last ${daysToKeep} days)`);

  const stats = {
    checked: 0,
    deleted: 0,
    freedBytes: 0
  };

  const uploadsDir = config.uploadsPath;

  if (!fs.existsSync(uploadsDir)) {
    return stats;
  }

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(uploadsDir).filter(name => name.endsWith('.xlsx'));

  for (const file of files) {
    stats.checked++;

    try {
      const filePath = path.join(uploadsDir, file);
      const fileStats = fs.statSync(filePath);

      if (now - fileStats.mtime.getTime() > maxAge) {
        stats.freedBytes += fileStats.size;
        fs.unlinkSync(filePath);
        stats.deleted++;
      }
    } catch (error) {
      logger.error(`Error deleting upload ${file}: ${error.message}`);
    }
  }

  logger.info(`Upload cleanup complete: ${stats.deleted} files deleted`);

  return stats;
}

/**
 * Clean up old log files
 * @param {number} daysToKeep - Number of days to keep logs
 */
function cleanupOldLogs(daysToKeep = 14) {
  const logDir = path.join(config.storagePath, 'logs');

  if (!fs.existsSync(logDir)) {
    return { deleted: 0 };
  }

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  let deleted = 0;

  const files = fs.readdirSync(logDir).filter(name => name.endsWith('.log'));

  for (const file of files) {
    try {
      const filePath = path.join(logDir, file);
      const fileStats = fs.statSync(filePath);

      if (now - fileStats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (error) {
      logger.error(`Error deleting log ${file}: ${error.message}`);
    }
  }

  return { deleted };
}

/**
 * Get directory size recursively
 * @param {string} dirPath - Directory path
 * @returns {number} - Size in bytes
 */
function getDirectorySize(dirPath) {
  let size = 0;

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stats.size;
    }
  }

  return size;
}

/**
 * Format bytes to human readable
 * @param {number} bytes - Size in bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get storage statistics
 * @returns {Object}
 */
function getStorageStats() {
  const stats = {
    uploads: { count: 0, size: 0 },
    results: { count: 0, size: 0 },
    exports: { count: 0, size: 0 },
    logs: { count: 0, size: 0 },
    total: 0
  };

  // Uploads
  if (fs.existsSync(config.uploadsPath)) {
    const files = fs.readdirSync(config.uploadsPath).filter(f => f.endsWith('.xlsx'));
    stats.uploads.count = files.length;
    stats.uploads.size = files.reduce((acc, f) => {
      try {
        return acc + fs.statSync(path.join(config.uploadsPath, f)).size;
      } catch {
        return acc;
      }
    }, 0);
  }

  // Results
  if (fs.existsSync(config.resultsPath)) {
    const dirs = fs.readdirSync(config.resultsPath).filter(d => d.startsWith('JOB_'));
    stats.results.count = dirs.length;
    stats.results.size = dirs.reduce((acc, d) => {
      try {
        return acc + getDirectorySize(path.join(config.resultsPath, d));
      } catch {
        return acc;
      }
    }, 0);
  }

  // Exports
  if (fs.existsSync(config.exportsPath)) {
    const files = fs.readdirSync(config.exportsPath).filter(f => f.endsWith('.csv'));
    stats.exports.count = files.length;
    stats.exports.size = files.reduce((acc, f) => {
      try {
        return acc + fs.statSync(path.join(config.exportsPath, f)).size;
      } catch {
        return acc;
      }
    }, 0);
  }

  // Logs
  const logDir = path.join(config.storagePath, 'logs');
  if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    stats.logs.count = files.length;
    stats.logs.size = files.reduce((acc, f) => {
      try {
        return acc + fs.statSync(path.join(logDir, f)).size;
      } catch {
        return acc;
      }
    }, 0);
  }

  stats.total = stats.uploads.size + stats.results.size + stats.exports.size + stats.logs.size;

  // Format for display
  stats.uploads.sizeFormatted = formatBytes(stats.uploads.size);
  stats.results.sizeFormatted = formatBytes(stats.results.size);
  stats.exports.sizeFormatted = formatBytes(stats.exports.size);
  stats.logs.sizeFormatted = formatBytes(stats.logs.size);
  stats.totalFormatted = formatBytes(stats.total);

  return stats;
}

/**
 * Run all cleanup tasks
 */
function runFullCleanup() {
  logger.info('Starting full cleanup...');

  const results = {
    jobs: cleanupOldJobs(30),
    uploads: cleanupOldUploads(7),
    logs: cleanupOldLogs(14)
  };

  logger.info('Full cleanup complete', results);

  return results;
}

module.exports = {
  cleanupOldJobs,
  cleanupOldUploads,
  cleanupOldLogs,
  getDirectorySize,
  formatBytes,
  getStorageStats,
  runFullCleanup
};
