const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * UPC statuses
 */
const UPC_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  FAILED: 'FAILED',
  NOT_FOUND: 'NOT_FOUND'
};

/**
 * Get UPCs file path for a job
 */
function getUpcsFilePath(jobId) {
  return path.join(config.resultsPath, jobId, 'upcs.json');
}

/**
 * Load UPCs for a job
 */
function loadUpcs(jobId) {
  const filePath = getUpcsFilePath(jobId);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`[UPC] Failed to load UPCs for job ${jobId}:`, error.message);
    return [];
  }
}

/**
 * Save UPCs for a job
 */
function saveUpcs(jobId, upcs) {
  const filePath = getUpcsFilePath(jobId);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(upcs, null, 2));
}

/**
 * Get next pending UPC for a job
 */
function getNextPendingUpc(jobId) {
  const upcs = loadUpcs(jobId);

  const pending = upcs.find(upc => upc.status === UPC_STATUS.PENDING);

  return pending || null;
}

/**
 * Get UPC by rowId
 */
function getUpcByRowId(jobId, rowId) {
  const upcs = loadUpcs(jobId);
  return upcs.find(upc => upc.rowId === rowId) || null;
}

/**
 * Update UPC status
 */
function updateUpcStatus(jobId, rowId, status) {
  const upcs = loadUpcs(jobId);

  const upcIndex = upcs.findIndex(upc => upc.rowId === rowId);
  if (upcIndex === -1) {
    console.error(`[UPC] UPC with rowId ${rowId} not found in job ${jobId}`);
    return null;
  }

  upcs[upcIndex].status = status;
  upcs[upcIndex].updatedAt = new Date().toISOString();

  saveUpcs(jobId, upcs);

  return upcs[upcIndex];
}

/**
 * Mark UPC as in progress
 */
function markUpcInProgress(jobId, rowId) {
  return updateUpcStatus(jobId, rowId, UPC_STATUS.IN_PROGRESS);
}

/**
 * Mark UPC as done
 */
function markUpcDone(jobId, rowId) {
  return updateUpcStatus(jobId, rowId, UPC_STATUS.DONE);
}

/**
 * Mark UPC as failed
 */
function markUpcFailed(jobId, rowId) {
  return updateUpcStatus(jobId, rowId, UPC_STATUS.FAILED);
}

/**
 * Mark UPC as not found
 */
function markUpcNotFound(jobId, rowId) {
  return updateUpcStatus(jobId, rowId, UPC_STATUS.NOT_FOUND);
}

/**
 * Reset IN_PROGRESS UPCs to PENDING (for recovery)
 */
function resetInProgressUpcs(jobId) {
  const upcs = loadUpcs(jobId);

  let resetCount = 0;
  upcs.forEach(upc => {
    if (upc.status === UPC_STATUS.IN_PROGRESS) {
      upc.status = UPC_STATUS.PENDING;
      upc.updatedAt = new Date().toISOString();
      resetCount++;
    }
  });

  if (resetCount > 0) {
    saveUpcs(jobId, upcs);
    console.log(`[UPC] Reset ${resetCount} IN_PROGRESS UPCs to PENDING for job ${jobId}`);
  }

  return resetCount;
}

/**
 * Get UPC statistics for a job
 */
function getUpcStats(jobId) {
  const upcs = loadUpcs(jobId);

  const stats = {
    total: upcs.length,
    pending: 0,
    inProgress: 0,
    done: 0,
    failed: 0,
    notFound: 0
  };

  upcs.forEach(upc => {
    switch (upc.status) {
      case UPC_STATUS.PENDING:
        stats.pending++;
        break;
      case UPC_STATUS.IN_PROGRESS:
        stats.inProgress++;
        break;
      case UPC_STATUS.DONE:
        stats.done++;
        break;
      case UPC_STATUS.FAILED:
        stats.failed++;
        break;
      case UPC_STATUS.NOT_FOUND:
        stats.notFound++;
        break;
    }
  });

  return stats;
}

/**
 * Get all UPCs with a specific status
 */
function getUpcsByStatus(jobId, status) {
  const upcs = loadUpcs(jobId);
  return upcs.filter(upc => upc.status === status);
}

/**
 * Check if all UPCs are processed
 */
function isAllUpcsProcessed(jobId) {
  const upcs = loadUpcs(jobId);

  return upcs.every(upc =>
    upc.status === UPC_STATUS.DONE ||
    upc.status === UPC_STATUS.FAILED ||
    upc.status === UPC_STATUS.NOT_FOUND
  );
}

/**
 * Get progress percentage
 */
function getProgressPercentage(jobId) {
  const stats = getUpcStats(jobId);

  if (stats.total === 0) return 100;

  const processed = stats.done + stats.failed + stats.notFound;
  return Math.round((processed / stats.total) * 100);
}

module.exports = {
  UPC_STATUS,
  loadUpcs,
  saveUpcs,
  getNextPendingUpc,
  getUpcByRowId,
  updateUpcStatus,
  markUpcInProgress,
  markUpcDone,
  markUpcFailed,
  markUpcNotFound,
  resetInProgressUpcs,
  getUpcStats,
  getUpcsByStatus,
  isAllUpcsProcessed,
  getProgressPercentage
};
