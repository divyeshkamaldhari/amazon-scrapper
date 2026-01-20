/**
 * Validation Service for matching scraped data with input data
 */

/**
 * Validate if scraped brand matches input brand
 * @param {string} scrapedBrand - Brand from Amazon
 * @param {string} inputBrand - Brand from input Excel
 * @returns {boolean}
 */
function validateBrand(scrapedBrand, inputBrand) {
  if (!scrapedBrand || !inputBrand) {
    return false;
  }

  const normalizedScraped = normalizeBrandName(scrapedBrand);
  const normalizedInput = normalizeBrandName(inputBrand);

  // Check if scraped brand contains input brand
  return normalizedScraped.includes(normalizedInput);
}

/**
 * Validate if scraped UPC matches input UPC
 * @param {string} scrapedUpc - UPC from Amazon
 * @param {string} inputUpc - UPC from input Excel
 * @returns {boolean}
 */
function validateUpc(scrapedUpc, inputUpc) {
  if (!scrapedUpc || !inputUpc) {
    return false;
  }

  // Normalize both UPCs (remove non-digits)
  const normalizedScraped = normalizeUpc(scrapedUpc);
  const normalizedInput = normalizeUpc(inputUpc);

  // Check if scraped UPC contains input UPC
  return normalizedScraped.includes(normalizedInput);
}

/**
 * Normalize brand name for comparison
 * - Convert to lowercase
 * - Remove special characters
 * - Trim whitespace
 * @param {string} brand - Brand name
 * @returns {string}
 */
function normalizeBrandName(brand) {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize UPC for comparison
 * - Remove all non-digit characters
 * @param {string} upc - UPC code
 * @returns {string}
 */
function normalizeUpc(upc) {
  return String(upc).replace(/\D/g, '');
}

/**
 * Validate a product result against input data
 * @param {Object} product - Scraped product data
 * @param {string} inputBrand - Input brand from Excel
 * @param {string} inputUpc - Input UPC from Excel
 * @returns {{brandMatch: boolean, upcMatch: boolean}}
 */
function validateProduct(product, inputBrand, inputUpc) {
  return {
    brandMatch: validateBrand(product.brand, inputBrand),
    upcMatch: validateUpc(product.upc, inputUpc)
  };
}

module.exports = {
  validateBrand,
  validateUpc,
  validateProduct,
  normalizeBrandName,
  normalizeUpc
};
