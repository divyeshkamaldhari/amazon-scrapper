const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const upload = require('../config/multer');

// POST /api/jobs/upload - Upload Excel file
router.post('/upload', upload.single('file'), jobController.uploadExcel);

// GET /api/jobs - List all jobs
router.get('/', jobController.getJobs);

// GET /api/jobs/:id - Get job details
router.get('/:id', jobController.getJobById);

// GET /api/jobs/:id/download - Download CSV
router.get('/:id/download', jobController.downloadCsv);

// POST /api/jobs/:id/pause - Pause job
router.post('/:id/pause', jobController.pauseJob);

// POST /api/jobs/:id/resume - Resume job
router.post('/:id/resume', jobController.resumeJob);

// GET /api/jobs/:id/logs - Get job logs
router.get('/:id/logs', jobController.getJobLogs);

// DELETE /api/jobs/:id - Delete job
router.delete('/:id', jobController.deleteJob);

module.exports = router;
