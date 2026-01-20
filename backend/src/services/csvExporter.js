const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const config = require('../config');
const resultStorage = require('./resultStorage');

/**
 * CSV column headers as specified in requirements
 */
const CSV_HEADERS = [
  { id: 'inputUpc', title: 'Input UPC' },
  { id: 'inputBrand', title: 'Input Brand' },
  { id: 'asin1', title: 'ASIN1' },
  { id: 'brand1', title: 'Brand1' },
  { id: 'customerReviews', title: 'Customer reviews' },
  { id: 'globalRatings', title: 'Global ratings' },
  { id: 'upc1', title: 'UPC1' },
  { id: 'bsr1', title: 'BSR1' },
  { id: 'competitors1', title: 'Competitors1' },
  { id: 'brandMatch1', title: 'Brand Match1' },
  { id: 'upcMatch1', title: 'UPC Match1' },
  { id: 'status', title: 'Status' }
];

/**
 * Generate CSV file for a completed job
 * @param {string} jobId - Job ID
 * @returns {Promise<{success: boolean, filePath: string|null, error: string|null}>}
 */
async function generateCsv(jobId) {
  console.log(`[CSV] Generating CSV for job ${jobId}`);

  try {
    // Get flattened results for export
    const results = resultStorage.getAllResultsForExport(jobId);

    if (results.length === 0) {
      return {
        success: false,
        filePath: null,
        error: 'No results to export'
      };
    }

    // Ensure exports directory exists
    if (!fs.existsSync(config.exportsPath)) {
      fs.mkdirSync(config.exportsPath, { recursive: true });
    }

    const csvPath = path.join(config.exportsPath, `${jobId}.csv`);

    // Create CSV writer
    const csvWriter = createCsvWriter({
      path: csvPath,
      header: CSV_HEADERS
    });

    // Format data for CSV
    const formattedData = results.map(row => ({
      inputUpc: row.inputUpc || '',
      inputBrand: row.inputBrand || '',
      asin1: row.asin || '',
      brand1: row.amazonBrand || '',
      customerReviews: row.reviews !== null && row.reviews !== undefined ? row.reviews : '',
      globalRatings: row.rating !== null && row.rating !== undefined ? row.rating : '',
      upc1: row.scrapedUpc || row.inputUpc || '',
      bsr1: row.bsr !== null && row.bsr !== undefined ? row.bsr : '',
      competitors1: row.competitors || '',
      brandMatch1: row.brandMatch ? 'Yes' : 'No',
      upcMatch1: row.upcMatch ? 'Yes' : 'No',
      status: row.status || ''
    }));

    // Write CSV
    await csvWriter.writeRecords(formattedData);

    console.log(`[CSV] Generated CSV at ${csvPath} with ${formattedData.length} rows`);

    return {
      success: true,
      filePath: csvPath,
      error: null,
      rowCount: formattedData.length
    };

  } catch (error) {
    console.error(`[CSV] Error generating CSV for job ${jobId}:`, error.message);
    return {
      success: false,
      filePath: null,
      error: error.message
    };
  }
}

/**
 * Check if CSV exists for a job
 * @param {string} jobId - Job ID
 * @returns {boolean}
 */
function csvExists(jobId) {
  const csvPath = path.join(config.exportsPath, `${jobId}.csv`);
  return fs.existsSync(csvPath);
}

/**
 * Get CSV file path for a job
 * @param {string} jobId - Job ID
 * @returns {string}
 */
function getCsvPath(jobId) {
  return path.join(config.exportsPath, `${jobId}.csv`);
}

/**
 * Delete CSV file for a job
 * @param {string} jobId - Job ID
 */
function deleteCsv(jobId) {
  const csvPath = getCsvPath(jobId);
  if (fs.existsSync(csvPath)) {
    fs.unlinkSync(csvPath);
    console.log(`[CSV] Deleted CSV for job ${jobId}`);
  }
}

module.exports = {
  generateCsv,
  csvExists,
  getCsvPath,
  deleteCsv,
  CSV_HEADERS
};
