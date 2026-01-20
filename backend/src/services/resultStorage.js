const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Get results file path for a job
 */
function getResultsFilePath(jobId) {
  return path.join(config.resultsPath, jobId, 'results.json');
}

/**
 * Load results for a job
 */
function loadResults(jobId) {
  const filePath = getResultsFilePath(jobId);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`[RESULT] Failed to load results for job ${jobId}:`, error.message);
    return [];
  }
}

/**
 * Save all results for a job
 */
function saveResults(jobId, results) {
  const filePath = getResultsFilePath(jobId);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
}

/**
 * Save a single UPC result (incremental)
 * @param {string} jobId - Job ID
 * @param {Object} result - Result object with structure:
 *   {
 *     rowId: number,
 *     inputUpc: string,
 *     inputBrand: string,
 *     results: [{
 *       asin: string,
 *       brand: string,
 *       brandMatch: boolean,
 *       upcMatch: boolean,
 *       rating: number,
 *       reviews: number,
 *       bsr: number
 *     }],
 *     status: string
 *   }
 */
function saveUpcResult(jobId, result) {
  const results = loadResults(jobId);

  // Check if result for this rowId already exists
  const existingIndex = results.findIndex(r => r.rowId === result.rowId);

  if (existingIndex !== -1) {
    // Update existing result
    results[existingIndex] = result;
  } else {
    // Add new result
    results.push(result);
  }

  // Add timestamp
  result.savedAt = new Date().toISOString();

  saveResults(jobId, results);

  console.log(`[RESULT] Saved result for UPC rowId ${result.rowId} in job ${jobId}`);

  return result;
}

/**
 * Get result by rowId
 */
function getResultByRowId(jobId, rowId) {
  const results = loadResults(jobId);
  return results.find(r => r.rowId === rowId) || null;
}

/**
 * Get results count
 */
function getResultsCount(jobId) {
  const results = loadResults(jobId);
  return results.length;
}

/**
 * Get results statistics
 */
function getResultsStats(jobId) {
  const results = loadResults(jobId);

  const stats = {
    total: results.length,
    done: 0,
    failed: 0,
    notFound: 0,
    withMatches: 0,
    brandMatches: 0,
    upcMatches: 0
  };

  results.forEach(result => {
    switch (result.status) {
      case 'DONE':
        stats.done++;
        break;
      case 'FAILED':
        stats.failed++;
        break;
      case 'NOT_FOUND':
        stats.notFound++;
        break;
    }

    // Count matches from product results
    if (result.results && result.results.length > 0) {
      const hasMatch = result.results.some(r => r.brandMatch || r.upcMatch);
      if (hasMatch) stats.withMatches++;

      result.results.forEach(r => {
        if (r.brandMatch) stats.brandMatches++;
        if (r.upcMatch) stats.upcMatches++;
      });
    }
  });

  return stats;
}

/**
 * Clear results for a job
 */
function clearResults(jobId) {
  const filePath = getResultsFilePath(jobId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[RESULT] Cleared results for job ${jobId}`);
  }
}

/**
 * Get all results for CSV export
 */
function getAllResultsForExport(jobId) {
  const results = loadResults(jobId);

  // Flatten results: one row per ASIN (or one row per UPC if no ASINs found)
  const flatResults = [];

  results.forEach(result => {
    // Count competitors (total products found for this UPC)
    const competitorsCount = result.results ? result.results.length : 0;

    if (!result.results || result.results.length === 0) {
      // No products found - add single row with empty product data
      flatResults.push({
        inputUpc: result.inputUpc,
        inputBrand: result.inputBrand,
        asin: '',
        amazonBrand: '',
        brandMatch: false,
        upcMatch: false,
        rating: '',
        reviews: '',
        bsr: '',
        scrapedUpc: '',
        competitors: competitorsCount,
        status: result.status
      });
    } else {
      // Add row for each product found
      result.results.forEach(product => {
        flatResults.push({
          inputUpc: result.inputUpc,
          inputBrand: result.inputBrand,
          asin: product.asin || '',
          amazonBrand: product.brand || '',
          brandMatch: product.brandMatch || false,
          upcMatch: product.upcMatch || false,
          rating: product.rating || '',
          reviews: product.reviews || '',
          bsr: product.bsr || '',
          scrapedUpc: product.upc || '',
          competitors: competitorsCount,
          status: result.status
        });
      });
    }
  });

  return flatResults;
}

module.exports = {
  loadResults,
  saveResults,
  saveUpcResult,
  getResultByRowId,
  getResultsCount,
  getResultsStats,
  clearResults,
  getAllResultsForExport
};
