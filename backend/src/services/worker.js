const jobManager = require('./jobManager');
const upcQueue = require('./upcQueue');
const resultStorage = require('./resultStorage');
const { searchAmazon } = require('./scraper/searchScraper');
const { scrapeProductPage } = require('./scraper/productScraper');
const { validateProduct } = require('./validator');
const { searchToProductDelay, productToProductDelay, upcToUpcDelay, captchaPauseDelay } = require('../utils/delay');
const errorHandler = require('./errorHandler');
const csvExporter = require('./csvExporter');

// Error tracking per job
const jobErrors = new Map();

/**
 * Track error for a job
 */
function trackError(jobId, errorLog) {
  if (!jobErrors.has(jobId)) {
    jobErrors.set(jobId, []);
  }
  jobErrors.get(jobId).push(errorLog);

  // Keep only last 100 errors per job
  const errors = jobErrors.get(jobId);
  if (errors.length > 100) {
    errors.shift();
  }
}

/**
 * Get errors for a job
 */
function getJobErrors(jobId) {
  return jobErrors.get(jobId) || [];
}

/**
 * Clear errors for a job
 */
function clearJobErrors(jobId) {
  jobErrors.delete(jobId);
}

/**
 * Process a single UPC with enhanced error handling
 * @param {string} jobId - Job ID
 * @param {Object} upcData - UPC data {rowId, upc, brand}
 * @returns {Promise<Object>} Result object
 */
async function processUpc(jobId, upcData) {
  const { rowId, upc, brand } = upcData;

  console.log(`[WORKER] Processing UPC ${upc} (rowId: ${rowId})`);

  // Mark UPC as in progress
  upcQueue.markUpcInProgress(jobId, rowId);

  const result = {
    rowId,
    inputUpc: upc,
    inputBrand: brand,
    results: [],
    status: 'PENDING',
    attempts: 0
  };

  let attempt = 0;
  const MAX_ATTEMPTS = 3;

  while (attempt < MAX_ATTEMPTS) {
    try {
      // Search Amazon for the UPC
      const searchResult = await searchAmazon(upc);

      if (!searchResult.success) {
        const errorInfo = errorHandler.handleScrapingError(
          { status: 0, data: searchResult.error },
          attempt
        );

        // Log the error
        trackError(jobId, errorHandler.createErrorLog({
          jobId,
          upc,
          rowId,
          errorType: errorInfo.errorType,
          message: errorInfo.message,
          attempt,
          action: errorInfo.action
        }));

        // Check for CAPTCHA
        if (errorInfo.errorType === errorHandler.ERROR_TYPES.CAPTCHA) {
          console.warn(`[WORKER] CAPTCHA detected for UPC ${upc}`);
          result.status = 'CAPTCHA';
          return result;
        }

        // Check if should retry
        if (errorInfo.shouldRetry) {
          console.log(`[WORKER] Retrying UPC ${upc} after ${errorInfo.delay}ms (attempt ${attempt + 1})`);
          await errorHandler.sleep(errorInfo.delay);
          attempt++;
          continue;
        }

        console.error(`[WORKER] Search failed for UPC ${upc}: ${searchResult.error}`);
        result.status = 'FAILED';
        result.error = searchResult.error;
        upcQueue.markUpcFailed(jobId, rowId);
        resultStorage.saveUpcResult(jobId, result);
        return result;
      }

      // No results found
      if (searchResult.asins.length === 0) {
        console.log(`[WORKER] No products found for UPC ${upc}`);
        result.status = 'NOT_FOUND';
        upcQueue.markUpcNotFound(jobId, rowId);
        resultStorage.saveUpcResult(jobId, result);
        return result;
      }

      // Process each ASIN (max 3)
      for (let i = 0; i < searchResult.asins.length; i++) {
        const { asin } = searchResult.asins[i];

        // Delay between search and product page
        if (i === 0) {
          await searchToProductDelay();
        } else {
          await productToProductDelay();
        }

        // Scrape product page with retry
        let productResult = null;
        let productAttempt = 0;

        while (productAttempt < 2) {
          productResult = await scrapeProductPage(asin);

          if (productResult.success) {
            break;
          }

          const errorInfo = errorHandler.handleScrapingError(
            { status: 0, data: productResult.error },
            productAttempt
          );

          if (errorInfo.errorType === errorHandler.ERROR_TYPES.CAPTCHA) {
            console.warn(`[WORKER] CAPTCHA detected on product page ${asin}`);
            result.status = 'CAPTCHA';
            return result;
          }

          if (errorInfo.shouldRetry && productAttempt < 1) {
            console.log(`[WORKER] Retrying product ${asin} after ${errorInfo.delay}ms`);
            await errorHandler.sleep(errorInfo.delay);
            productAttempt++;
            continue;
          }

          break;
        }

        if (!productResult || !productResult.success) {
          console.warn(`[WORKER] Failed to scrape product ${asin}: ${productResult?.error || 'Unknown'}`);
          continue; // Skip this ASIN, try next
        }

        // Validate brand and UPC
        const validation = validateProduct(productResult.data, brand, upc);

        // Add to results
        result.results.push({
          asin,
          brand: productResult.data.brand,
          title: productResult.data.title,
          brandMatch: validation.brandMatch,
          upcMatch: validation.upcMatch,
          rating: productResult.data.rating,
          reviews: productResult.data.reviews,
          bsr: productResult.data.bsr,
          price: productResult.data.price,
          scrapedUpc: productResult.data.upc
        });
      }

      result.status = 'DONE';
      result.attempts = attempt + 1;
      upcQueue.markUpcDone(jobId, rowId);
      resultStorage.saveUpcResult(jobId, result);
      return result;

    } catch (error) {
      console.error(`[WORKER] Error processing UPC ${upc}:`, error.message);

      const errorInfo = errorHandler.handleScrapingError(error, attempt);

      trackError(jobId, errorHandler.createErrorLog({
        jobId,
        upc,
        rowId,
        errorType: errorInfo.errorType,
        message: error.message,
        attempt,
        action: errorInfo.action
      }));

      if (errorInfo.shouldRetry) {
        console.log(`[WORKER] Retrying UPC ${upc} after error (attempt ${attempt + 1})`);
        await errorHandler.sleep(errorInfo.delay);
        attempt++;
        continue;
      }

      result.status = 'FAILED';
      result.error = error.message;
      result.attempts = attempt + 1;
      upcQueue.markUpcFailed(jobId, rowId);
      resultStorage.saveUpcResult(jobId, result);
      return result;
    }
  }

  // Max attempts reached
  result.status = 'FAILED';
  result.error = 'Max retry attempts reached';
  result.attempts = attempt;
  upcQueue.markUpcFailed(jobId, rowId);
  resultStorage.saveUpcResult(jobId, result);
  return result;
}

/**
 * Main worker loop for processing a job
 * @param {string} jobId - Job ID to process
 */
async function runWorker(jobId) {
  console.log(`[WORKER] Starting worker for job ${jobId}`);

  // Update job status to RUNNING
  jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.RUNNING);

  let consecutiveCaptchas = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_CAPTCHAS = 3;
  const MAX_CONSECUTIVE_ERRORS = 10;

  while (true) {
    // Check job status (might be paused or stopped)
    const job = jobManager.getJob(jobId);

    if (!job) {
      console.log(`[WORKER] Job ${jobId} not found, stopping worker`);
      break;
    }

    if (job.status === jobManager.JOB_STATUS.PAUSED) {
      console.log(`[WORKER] Job ${jobId} is paused, stopping worker`);
      break;
    }

    if (job.status === jobManager.JOB_STATUS.COMPLETED || job.status === jobManager.JOB_STATUS.FAILED) {
      console.log(`[WORKER] Job ${jobId} is ${job.status}, stopping worker`);
      break;
    }

    // Get next pending UPC
    const nextUpc = upcQueue.getNextPendingUpc(jobId);

    if (!nextUpc) {
      // No more UPCs to process - job is complete
      console.log(`[WORKER] No more UPCs to process for job ${jobId}`);

      // Check if all UPCs are processed
      if (upcQueue.isAllUpcsProcessed(jobId)) {
        // Generate CSV automatically
        console.log(`[WORKER] Generating CSV for job ${jobId}`);
        try {
          await csvExporter.generateCsv(jobId);
        } catch (csvError) {
          console.error(`[WORKER] Failed to generate CSV: ${csvError.message}`);
        }

        jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.COMPLETED);
        console.log(`[WORKER] Job ${jobId} completed successfully`);

        // Clear error tracking for this job
        clearJobErrors(jobId);
      }
      break;
    }

    // Process the UPC
    const result = await processUpc(jobId, nextUpc);

    // Handle CAPTCHA
    if (result.status === 'CAPTCHA') {
      consecutiveCaptchas++;
      consecutiveErrors++;
      console.warn(`[WORKER] CAPTCHA count: ${consecutiveCaptchas}`);

      if (consecutiveCaptchas >= MAX_CONSECUTIVE_CAPTCHAS) {
        console.warn(`[WORKER] Too many CAPTCHAs, pausing job ${jobId}`);
        jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.PAUSED, 'CAPTCHA detected - job paused. Please wait 30-60 minutes before resuming.');

        // Reset the UPC status to pending so it can be retried
        upcQueue.updateUpcStatus(jobId, nextUpc.rowId, upcQueue.UPC_STATUS.PENDING);
        break;
      }

      // Reset UPC to pending and continue with delay
      upcQueue.updateUpcStatus(jobId, nextUpc.rowId, upcQueue.UPC_STATUS.PENDING);
      await captchaPauseDelay();
      continue;
    }

    // Handle consecutive errors
    if (result.status === 'FAILED') {
      consecutiveErrors++;

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[WORKER] Too many consecutive errors (${consecutiveErrors}), pausing job ${jobId}`);
        jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.PAUSED, `Too many errors (${consecutiveErrors}). Please check network connectivity.`);
        break;
      }
    } else {
      // Reset counters on success
      consecutiveCaptchas = 0;
      consecutiveErrors = 0;
    }

    // Update job progress
    const stats = upcQueue.getUpcStats(jobId);
    jobManager.updateJobProgress(
      jobId,
      stats.done + stats.failed + stats.notFound,
      stats.failed,
      null,
      nextUpc.rowId
    );

    // Delay before next UPC
    await upcToUpcDelay();
  }

  console.log(`[WORKER] Worker for job ${jobId} stopped`);
}

/**
 * Start worker for a job (non-blocking)
 * @param {string} jobId - Job ID
 */
function startWorker(jobId) {
  // Run worker in background (don't await)
  runWorker(jobId).catch(error => {
    console.error(`[WORKER] Worker crashed for job ${jobId}:`, error);

    trackError(jobId, errorHandler.createErrorLog({
      jobId,
      upc: null,
      rowId: null,
      errorType: errorHandler.ERROR_TYPES.UNKNOWN,
      message: `Worker crashed: ${error.message}`,
      attempt: 0,
      action: 'FAIL'
    }));

    jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.FAILED, `Worker crashed: ${error.message}`);
  });
}

/**
 * Resume worker for jobs that were running (after server restart)
 */
async function resumeRunningJobs() {
  const runningJobs = jobManager.getJobsToResume();

  console.log(`[WORKER] Found ${runningJobs.length} jobs to resume`);

  for (const job of runningJobs) {
    console.log(`[WORKER] Resuming job ${job.jobId}`);

    // Reset any IN_PROGRESS UPCs to PENDING
    const resetCount = upcQueue.resetInProgressUpcs(job.jobId);
    if (resetCount > 0) {
      console.log(`[WORKER] Reset ${resetCount} in-progress UPCs to pending for job ${job.jobId}`);
    }

    // Start worker
    startWorker(job.jobId);
  }
}

module.exports = {
  processUpc,
  runWorker,
  startWorker,
  resumeRunningJobs,
  getJobErrors,
  clearJobErrors
};
