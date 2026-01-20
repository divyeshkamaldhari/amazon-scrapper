const cheerio = require('cheerio');
const { fetchPage } = require('./httpClient');
const selectors = require('../../config/selectors');

const MAX_ASINS = 3;

/**
 * Search Amazon for a UPC and return ASINs
 * @param {string} upc - UPC code to search for
 * @returns {Promise<{success: boolean, asins: Array<{asin: string, url: string}>, error: string|null, usedFallback: boolean}>}
 */
async function searchAmazon(upc) {
  console.log(`[SEARCH] Searching for UPC: ${upc}`);

  // First attempt with original UPC
  let result = await performSearch(upc);

  if (result.success && result.asins.length > 0) {
    return { ...result, usedFallback: false };
  }

  // Fallback: prepend "00" and retry
  if (!result.success || result.asins.length === 0) {
    const fallbackUpc = '00' + upc;
    console.log(`[SEARCH] No results for ${upc}, trying fallback: ${fallbackUpc}`);

    result = await performSearch(fallbackUpc);

    if (result.success && result.asins.length > 0) {
      return { ...result, usedFallback: true };
    }
  }

  // No results found even with fallback
  return {
    success: true,
    asins: [],
    error: null,
    usedFallback: true
  };
}

/**
 * Perform the actual search request and parse results
 * @param {string} searchTerm - Search term (UPC)
 * @returns {Promise<{success: boolean, asins: Array, error: string|null}>}
 */
async function performSearch(searchTerm) {
  const searchUrl = `${selectors.urls.searchBase}${encodeURIComponent(searchTerm)}`;

  const response = await fetchPage(searchUrl);

  if (!response.success) {
    return {
      success: false,
      asins: [],
      error: response.error
    };
  }

  const asins = parseSearchResults(response.data);

  return {
    success: true,
    asins,
    error: null
  };
}

/**
 * Parse search results HTML and extract ASINs
 * @param {string} html - HTML content
 * @returns {Array<{asin: string, url: string}>}
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const asins = [];

  // Find all product result items
  const resultItems = $(selectors.search.resultItem);

  console.log(`[SEARCH] Found ${resultItems.length} result items`);

  resultItems.each((index, element) => {
    if (asins.length >= MAX_ASINS) {
      return false; // Stop iteration
    }

    const $item = $(element);

    // Check if sponsored (skip sponsored results)
    if (isSponsored($, $item)) {
      console.log(`[SEARCH] Skipping sponsored result`);
      return; // Continue to next item
    }

    // Get ASIN from data attribute
    const asin = $item.attr(selectors.search.asinAttribute);

    if (asin && asin.length > 0 && !asins.find(a => a.asin === asin)) {
      asins.push({
        asin,
        url: `${selectors.urls.productBase}${asin}`
      });
      console.log(`[SEARCH] Found ASIN: ${asin}`);
    }
  });

  return asins;
}

/**
 * Check if a result item is sponsored
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $item - Result item element
 * @returns {boolean}
 */
function isSponsored($, $item) {
  // Check for sponsored indicators
  for (const selector of selectors.search.sponsoredBadge) {
    if ($item.find(selector).length > 0 || $item.is(selector)) {
      return true;
    }
  }

  // Check if text contains "Sponsored"
  const itemText = $item.text();
  if (itemText.includes('Sponsored')) {
    return true;
  }

  return false;
}

/**
 * Check if search returned no results
 * @param {string} html - HTML content
 * @returns {boolean}
 */
function hasNoResults(html) {
  const $ = cheerio.load(html);
  return $(selectors.search.noResults).length > 0;
}

module.exports = {
  searchAmazon,
  performSearch,
  parseSearchResults,
  isSponsored,
  hasNoResults
};
