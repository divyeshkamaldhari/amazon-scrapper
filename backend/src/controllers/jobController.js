const path = require('path');
const fs = require('fs');
const { parseExcelFile } = require('../services/excelParser');
const jobManager = require('../services/jobManager');
const upcQueue = require('../services/upcQueue');
const resultStorage = require('../services/resultStorage');
const { startWorker } = require('../services/worker');
const csvExporter = require('../services/csvExporter');
const config = require('../config');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');

/**
 * Upload Excel file and create a job
 * POST /api/jobs/upload
 */
async function uploadExcel(req, res, next) {
  try {
    // Check if file was uploaded
    if (!req.file) {
      throw new BadRequestError('No file uploaded. Please upload an Excel (.xlsx) file.');
    }

    const filePath = req.file.path;

    // Parse the Excel file
    const parseResult = parseExcelFile(filePath);

    if (!parseResult.success) {
      // Delete the uploaded file on parse failure
      fs.unlinkSync(filePath);
      throw new BadRequestError(parseResult.error);
    }

    // Create a job
    const job = jobManager.createJob(parseResult.data, filePath);

    res.status(201).json({
      success: true,
      message: 'File uploaded and job created successfully',
      data: {
        jobId: job.jobId,
        status: job.status,
        totalUpcs: job.totalUpcs,
        stats: parseResult.stats
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Get all jobs
 * GET /api/jobs
 */
async function getJobs(req, res, next) {
  try {
    const jobs = jobManager.getAllJobs();

    // Return jobs without upcs array for list view
    const jobList = jobs.map(job => ({
      jobId: job.jobId,
      status: job.status,
      totalUpcs: job.totalUpcs,
      processed: job.processed,
      failed: job.failed,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    }));

    res.json({
      success: true,
      data: jobList
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Get job by ID
 * GET /api/jobs/:id
 */
async function getJobById(req, res, next) {
  try {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    // Get UPC and result statistics
    const upcStats = upcQueue.getUpcStats(id);
    const resultStats = resultStorage.getResultsStats(id);

    // Return job details with statistics
    const jobDetails = {
      jobId: job.jobId,
      status: job.status,
      totalUpcs: job.totalUpcs,
      processed: job.processed,
      failed: job.failed,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      pausedAt: job.pausedAt,
      errorMessage: job.errorMessage,
      progress: job.totalUpcs > 0
        ? Math.round((job.processed / job.totalUpcs) * 100)
        : 0,
      upcStats,
      resultStats
    };

    res.json({
      success: true,
      data: jobDetails
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Download CSV for completed job
 * GET /api/jobs/:id/download
 */
async function downloadCsv(req, res, next) {
  try {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    if (job.status !== jobManager.JOB_STATUS.COMPLETED) {
      throw new BadRequestError(`Job is not completed yet. Current status: ${job.status}`);
    }

    const csvPath = path.join(config.exportsPath, `${id}.csv`);

    // Generate CSV if it doesn't exist
    if (!fs.existsSync(csvPath)) {
      const csvResult = await csvExporter.generateCsv(id);
      if (!csvResult.success) {
        throw new NotFoundError(`Failed to generate CSV: ${csvResult.error}`);
      }
    }

    res.download(csvPath, `${id}.csv`, (err) => {
      if (err) {
        next(err);
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Pause a running job
 * POST /api/jobs/:id/pause
 */
async function pauseJob(req, res, next) {
  try {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    if (job.status !== jobManager.JOB_STATUS.RUNNING) {
      throw new ConflictError(`Cannot pause job. Current status: ${job.status}`);
    }

    const updatedJob = jobManager.updateJobStatus(id, jobManager.JOB_STATUS.PAUSED);

    res.json({
      success: true,
      message: 'Job paused successfully',
      data: {
        jobId: updatedJob.jobId,
        status: updatedJob.status
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Resume a paused job
 * POST /api/jobs/:id/resume
 */
async function resumeJob(req, res, next) {
  try {
    const { id } = req.params;
    const job = jobManager.getJob(id);

    if (!job) {
      throw new NotFoundError(`Job ${id} not found`);
    }

    if (job.status !== jobManager.JOB_STATUS.PAUSED && job.status !== jobManager.JOB_STATUS.QUEUED) {
      throw new ConflictError(`Cannot resume job. Current status: ${job.status}`);
    }

    // Reset any IN_PROGRESS UPCs to PENDING before resuming
    upcQueue.resetInProgressUpcs(id);

    const updatedJob = jobManager.updateJobStatus(id, jobManager.JOB_STATUS.RUNNING);

    // Start the worker to process UPCs
    startWorker(id);

    res.json({
      success: true,
      message: 'Job resumed successfully',
      data: {
        jobId: updatedJob.jobId,
        status: updatedJob.status
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadExcel,
  getJobs,
  getJobById,
  downloadCsv,
  pauseJob,
  resumeJob
};
