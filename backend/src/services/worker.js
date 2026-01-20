const jobManager = require('./jobManager');
const upcQueue = require('./upcQueue');
const resultStorage = require('./resultStorage');
const { searchAmazon } = require('./scraper/searchScraper');
const { scrapeProductPage } = require('./scraper/productScraper');
const { validateProduct } = require('./validator');
const { searchToProductDelay, productToProductDelay, upcToUpcDelay, captchaPauseDelay } = require('../utils/delay');

/**
 * Process a single UPC
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
    status: 'PENDING'
  };

  try {
    // Search Amazon for the UPC
    const searchResult = await searchAmazon(upc);

    if (!searchResult.success) {
      // Check for CAPTCHA
      if (searchResult.error === 'CAPTCHA_DETECTED') {
        console.warn(`[WORKER] CAPTCHA detected for UPC ${upc}`);
        result.status = 'CAPTCHA';
        return result;
      }

      console.error(`[WORKER] Search failed for UPC ${upc}: ${searchResult.error}`);
      result.status = 'FAILED';
      result.error = searchResult.error;
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

      // Scrape product page
      const productResult = await scrapeProductPage(asin);

      if (!productResult.success) {
        if (productResult.error === 'CAPTCHA_DETECTED') {
          console.warn(`[WORKER] CAPTCHA detected on product page ${asin}`);
          result.status = 'CAPTCHA';
          return result;
        }

        console.warn(`[WORKER] Failed to scrape product ${asin}: ${productResult.error}`);
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
    upcQueue.markUpcDone(jobId, rowId);

  } catch (error) {
    console.error(`[WORKER] Error processing UPC ${upc}:`, error.message);
    result.status = 'FAILED';
    result.error = error.message;
    upcQueue.markUpcFailed(jobId, rowId);
  }

  // Save result
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
  const MAX_CONSECUTIVE_CAPTCHAS = 3;

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
        jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.COMPLETED);
        console.log(`[WORKER] Job ${jobId} completed successfully`);
      }
      break;
    }

    // Process the UPC
    const result = await processUpc(jobId, nextUpc);

    // Handle CAPTCHA
    if (result.status === 'CAPTCHA') {
      consecutiveCaptchas++;
      console.warn(`[WORKER] CAPTCHA count: ${consecutiveCaptchas}`);

      if (consecutiveCaptchas >= MAX_CONSECUTIVE_CAPTCHAS) {
        console.warn(`[WORKER] Too many CAPTCHAs, pausing job ${jobId}`);
        jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.PAUSED, 'CAPTCHA detected - job paused');

        // Long pause before resuming
        await captchaPauseDelay();

        // Reset the UPC status to pending so it can be retried
        upcQueue.updateUpcStatus(jobId, nextUpc.rowId, upcQueue.UPC_STATUS.PENDING);
        break;
      }

      // Reset UPC to pending and continue with delay
      upcQueue.updateUpcStatus(jobId, nextUpc.rowId, upcQueue.UPC_STATUS.PENDING);
      await captchaPauseDelay();
      continue;
    }

    // Reset CAPTCHA counter on success
    consecutiveCaptchas = 0;

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
    jobManager.updateJobStatus(jobId, jobManager.JOB_STATUS.FAILED, error.message);
  });
}

/**
 * Resume worker for jobs that were running (after server restart)
 */
async function resumeRunningJobs() {
  const runningJobs = jobManager.getJobsToResume();

  console.log(`[WORKER] Found ${runningJobs.length} jobs to resume`);

  for (const job of runningJobs) {
    // Reset any IN_PROGRESS UPCs to PENDING
    upcQueue.resetInProgressUpcs(job.jobId);

    // Start worker
    startWorker(job.jobId);
  }
}

module.exports = {
  processUpc,
  runWorker,
  startWorker,
  resumeRunningJobs
};
