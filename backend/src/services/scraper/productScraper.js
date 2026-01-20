const cheerio = require('cheerio');
const { fetchPage, isNotFoundPage } = require('./httpClient');
const selectors = require('../../config/selectors');

/**
 * Scrape product details from Amazon product page
 * @param {string} asin - Amazon ASIN
 * @returns {Promise<{success: boolean, data: Object|null, error: string|null}>}
 */
async function scrapeProductPage(asin) {
  console.log(`[PRODUCT] Scraping product page for ASIN: ${asin}`);

  const productUrl = `${selectors.urls.productBase}${asin}`;
  const response = await fetchPage(productUrl);

  if (!response.success) {
    return {
      success: false,
      data: null,
      error: response.error
    };
  }

  if (isNotFoundPage(response.data)) {
    return {
      success: false,
      data: null,
      error: 'Product not found'
    };
  }

  const productData = parseProductPage(response.data, asin);

  return {
    success: true,
    data: productData,
    error: null
  };
}

/**
 * Parse product page HTML and extract data
 * @param {string} html - HTML content
 * @param {string} asin - ASIN for reference
 * @returns {Object} Product data
 */
function parseProductPage(html, asin) {
  const $ = cheerio.load(html);

  const product = {
    asin,
    brand: extractBrand($),
    title: extractTitle($),
    rating: extractRating($),
    reviews: extractReviewCount($),
    upc: extractUpc($),
    bsr: extractBsr($),
    price: extractPrice($)
  };

  console.log(`[PRODUCT] Extracted data for ${asin}:`, {
    brand: product.brand,
    rating: product.rating,
    reviews: product.reviews,
    bsr: product.bsr
  });

  return product;
}

/**
 * Extract brand from product page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractBrand($) {
  for (const selector of selectors.product.brand) {
    const element = $(selector).first();
    if (element.length > 0) {
      let brandText = element.text().trim();

      // Clean up brand text (remove "Visit the X Store" prefix)
      brandText = brandText.replace(/^Visit the\s+/i, '').replace(/\s+Store$/i, '');
      brandText = brandText.replace(/^Brand:\s*/i, '');

      if (brandText) {
        return brandText;
      }
    }
  }
  return null;
}

/**
 * Extract product title
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractTitle($) {
  for (const selector of selectors.product.title) {
    const element = $(selector).first();
    if (element.length > 0) {
      const title = element.text().trim();
      if (title) {
        return title;
      }
    }
  }
  return null;
}

/**
 * Extract rating from product page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {number|null}
 */
function extractRating($) {
  for (const selector of selectors.product.rating) {
    const element = $(selector).first();
    if (element.length > 0) {
      const ratingText = element.text().trim();
      // Extract number from "4.5 out of 5 stars" format
      const match = ratingText.match(/(\d+\.?\d*)\s*out of/i);
      if (match) {
        return parseFloat(match[1]);
      }
      // Try direct number match
      const directMatch = ratingText.match(/^(\d+\.?\d*)$/);
      if (directMatch) {
        return parseFloat(directMatch[1]);
      }
    }
  }
  return null;
}

/**
 * Extract review count from product page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {number|null}
 */
function extractReviewCount($) {
  for (const selector of selectors.product.reviewCount) {
    const element = $(selector).first();
    if (element.length > 0) {
      const reviewText = element.text().trim();
      // Extract number, removing commas
      const match = reviewText.match(/([\d,]+)\s*(ratings?|reviews?|global ratings?)?/i);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
  }
  return null;
}

/**
 * Extract UPC/EAN from product details
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractUpc($) {
  // Look in product details tables
  for (const tableSelector of selectors.product.detailsTable) {
    const table = $(tableSelector);
    if (table.length > 0) {
      // Search for UPC/EAN labels
      for (const label of selectors.product.upcLabels) {
        // Try finding in table rows
        const row = table.find(`tr:contains("${label}")`);
        if (row.length > 0) {
          const value = row.find('td').last().text().trim();
          if (value && /^\d+$/.test(value.replace(/\s/g, ''))) {
            return value.replace(/\s/g, '');
          }
        }

        // Try finding in list items
        const listItem = table.find(`li:contains("${label}")`);
        if (listItem.length > 0) {
          const text = listItem.text();
          const match = text.match(new RegExp(`${label}[:\\s]+([\\d\\s]+)`, 'i'));
          if (match) {
            return match[1].replace(/\s/g, '');
          }
        }
      }
    }
  }

  // Try finding in detail bullets
  const detailBullets = $('#detailBullets_feature_div, .detail-bullet-list');
  for (const label of selectors.product.upcLabels) {
    const text = detailBullets.text();
    const match = text.match(new RegExp(`${label}[:\\s]+([\\d\\s]+)`, 'i'));
    if (match) {
      return match[1].replace(/\s/g, '');
    }
  }

  return null;
}

/**
 * Extract Best Seller Rank from product page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {number|null}
 */
function extractBsr($) {
  for (const selector of selectors.product.bsr) {
    const element = $(selector).first();
    if (element.length > 0) {
      const bsrText = element.text();
      // Extract first number (main category rank)
      // Format: "#1,234 in Category" or "#1,234 in Category (See Top 100)"
      const match = bsrText.match(/#?([\d,]+)\s+in\s/i);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
  }
  return null;
}

/**
 * Extract price from product page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractPrice($) {
  for (const selector of selectors.product.price) {
    const element = $(selector).first();
    if (element.length > 0) {
      const priceText = element.text().trim();
      if (priceText && priceText.includes('$')) {
        return priceText;
      }
    }
  }
  return null;
}

module.exports = {
  scrapeProductPage,
  parseProductPage,
  extractBrand,
  extractTitle,
  extractRating,
  extractReviewCount,
  extractUpc,
  extractBsr,
  extractPrice
};
