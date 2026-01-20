const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// In-memory job store
const jobs = new Map();

/**
 * Job statuses
 */
const JOB_STATUS = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [JOB_STATUS.QUEUED]: [JOB_STATUS.RUNNING, JOB_STATUS.FAILED],
  [JOB_STATUS.RUNNING]: [JOB_STATUS.PAUSED, JOB_STATUS.COMPLETED, JOB_STATUS.FAILED],
  [JOB_STATUS.PAUSED]: [JOB_STATUS.RUNNING, JOB_STATUS.FAILED],
  [JOB_STATUS.COMPLETED]: [],
  [JOB_STATUS.FAILED]: [JOB_STATUS.QUEUED] // Allow retry
};

/**
 * Validate state transition
 */
function isValidTransition(fromStatus, toStatus) {
  const validNextStates = VALID_TRANSITIONS[fromStatus] || [];
  return validNextStates.includes(toStatus);
}

/**
 * Create a new job
 */
function createJob(upcs, filePath) {
  const jobId = `JOB_${Date.now()}_${uuidv4().slice(0, 8)}`;

  const job = {
    jobId,
    status: JOB_STATUS.QUEUED,
    totalUpcs: upcs.length,
    processed: 0,
    failed: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    pausedAt: null,
    filePath,
    currentUpcIndex: 0,
    lastProcessedRowId: null,
    errorMessage: null
  };

  // Create job directory
  const jobDir = path.join(config.resultsPath, jobId);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  // Save UPCs to separate file
  const upcsPath = path.join(jobDir, 'upcs.json');
  fs.writeFileSync(upcsPath, JSON.stringify(upcs, null, 2));

  // Save job metadata
  saveJobMetadata(job);

  // Store in memory (without upcs to save memory)
  jobs.set(jobId, job);

  console.log(`[JOB] Created job ${jobId} with ${upcs.length} UPCs`);

  return { ...job, upcs };
}

/**
 * Get job by ID
 */
function getJob(jobId) {
  if (jobs.has(jobId)) {
    return jobs.get(jobId);
  }

  const loaded = loadJobMetadata(jobId);
  if (loaded) {
    jobs.set(jobId, loaded);
    return loaded;
  }

  return null;
}

/**
 * Get job with UPCs loaded
 */
function getJobWithUpcs(jobId) {
  const job = getJob(jobId);
  if (!job) return null;

  const upcsPath = path.join(config.resultsPath, jobId, 'upcs.json');
  if (fs.existsSync(upcsPath)) {
    try {
      job.upcs = JSON.parse(fs.readFileSync(upcsPath, 'utf8'));
    } catch (e) {
      job.upcs = [];
    }
  } else {
    job.upcs = [];
  }

  return job;
}

/**
 * Get all jobs
 */
function getAllJobs() {
  const resultsDir = config.resultsPath;

  if (!fs.existsSync(resultsDir)) {
    return [];
  }

  const jobDirs = fs.readdirSync(resultsDir).filter(name => {
    const fullPath = path.join(resultsDir, name);
    return fs.statSync(fullPath).isDirectory() && name.startsWith('JOB_');
  });

  const allJobs = jobDirs.map(jobId => getJob(jobId)).filter(job => job !== null);
  allJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return allJobs;
}

/**
 * Update job status with validation
 */
function updateJobStatus(jobId, newStatus, errorMessage = null) {
  const job = getJob(jobId);
  if (!job) return null;

  const oldStatus = job.status;

  // Validate transition
  if (!isValidTransition(oldStatus, newStatus)) {
    console.warn(`[JOB] Invalid transition: ${oldStatus} -> ${newStatus} for job ${jobId}`);
    return null;
  }

  job.status = newStatus;
  job.errorMessage = errorMessage;

  // Update timestamps based on new status
  const now = new Date().toISOString();

  switch (newStatus) {
    case JOB_STATUS.RUNNING:
      if (!job.startedAt) {
        job.startedAt = now;
      }
      job.pausedAt = null;
      break;

    case JOB_STATUS.PAUSED:
      job.pausedAt = now;
      break;

    case JOB_STATUS.COMPLETED:
    case JOB_STATUS.FAILED:
      job.completedAt = now;
      break;

    case JOB_STATUS.QUEUED:
      // Reset for retry
      job.startedAt = null;
      job.completedAt = null;
      job.pausedAt = null;
      job.errorMessage = null;
      break;
  }

  saveJobMetadata(job);
  jobs.set(jobId, job);

  console.log(`[JOB] Status changed: ${jobId} ${oldStatus} -> ${newStatus}`);

  return job;
}

/**
 * Update job progress
 */
function updateJobProgress(jobId, processed, failed, currentUpcIndex = null, lastProcessedRowId = null) {
  const job = getJob(jobId);
  if (!job) return null;

  job.processed = processed;
  job.failed = failed;

  if (currentUpcIndex !== null) {
    job.currentUpcIndex = currentUpcIndex;
  }

  if (lastProcessedRowId !== null) {
    job.lastProcessedRowId = lastProcessedRowId;
  }

  saveJobMetadata(job);
  jobs.set(jobId, job);

  return job;
}

/**
 * Increment job progress by 1
 */
function incrementProgress(jobId, success = true) {
  const job = getJob(jobId);
  if (!job) return null;

  job.processed += 1;
  if (!success) {
    job.failed += 1;
  }
  job.currentUpcIndex += 1;

  saveJobMetadata(job);
  jobs.set(jobId, job);

  return job;
}

/**
 * Check if job is complete
 */
function isJobComplete(jobId) {
  const job = getJob(jobId);
  if (!job) return false;

  return job.processed >= job.totalUpcs;
}

/**
 * Get jobs that need to be resumed (were RUNNING before crash)
 */
function getJobsToResume() {
  const allJobs = getAllJobs();
  return allJobs.filter(job => job.status === JOB_STATUS.RUNNING);
}

/**
 * Get next queued job
 */
function getNextQueuedJob() {
  const allJobs = getAllJobs();
  const queued = allJobs.filter(job => job.status === JOB_STATUS.QUEUED);

  if (queued.length === 0) return null;

  // Return oldest queued job
  queued.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return queued[0];
}

/**
 * Save job metadata to file
 */
function saveJobMetadata(job) {
  const jobDir = path.join(config.resultsPath, job.jobId);

  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  const metadataPath = path.join(jobDir, 'metadata.json');

  // Save without upcs array
  const metadata = { ...job };
  delete metadata.upcs;

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Load job metadata from file
 */
function loadJobMetadata(jobId) {
  const jobDir = path.join(config.resultsPath, jobId);
  const metadataPath = path.join(jobDir, 'metadata.json');

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    return metadata;
  } catch (error) {
    console.error(`[JOB] Failed to load job ${jobId}:`, error.message);
    return null;
  }
}

/**
 * Delete a job (cleanup)
 */
function deleteJob(jobId) {
  const jobDir = path.join(config.resultsPath, jobId);

  if (fs.existsSync(jobDir)) {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }

  jobs.delete(jobId);

  console.log(`[JOB] Deleted job ${jobId}`);
}

module.exports = {
  JOB_STATUS,
  VALID_TRANSITIONS,
  isValidTransition,
  createJob,
  getJob,
  getJobWithUpcs,
  getAllJobs,
  updateJobStatus,
  updateJobProgress,
  incrementProgress,
  isJobComplete,
  getJobsToResume,
  getNextQueuedJob,
  saveJobMetadata,
  loadJobMetadata,
  deleteJob
};
