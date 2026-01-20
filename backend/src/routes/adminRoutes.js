const express = require('express');
const router = express.Router();
const cleanup = require('../services/cleanup');

/**
 * GET /api/admin/stats
 * Get storage statistics
 */
router.get('/stats', (req, res) => {
  const stats = cleanup.getStorageStats();

  res.json({
    success: true,
    data: stats
  });
});

/**
 * POST /api/admin/cleanup
 * Run cleanup (delete old files)
 */
router.post('/cleanup', (req, res) => {
  const { jobDays = 30, uploadDays = 7, logDays = 14 } = req.body;

  const results = {
    jobs: cleanup.cleanupOldJobs(jobDays),
    uploads: cleanup.cleanupOldUploads(uploadDays),
    logs: cleanup.cleanupOldLogs(logDays)
  };

  res.json({
    success: true,
    message: 'Cleanup completed',
    data: results
  });
});

module.exports = router;
