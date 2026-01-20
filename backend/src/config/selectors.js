/**
 * CSS Selectors for Amazon page scraping
 * These selectors may need to be updated if Amazon changes their HTML structure
 */

module.exports = {
  // Search Results Page Selectors
  search: {
    // Main search results container
    resultsContainer: '[data-component-type="s-search-results"]',

    // Individual product result item
    resultItem: '[data-asin]:not([data-asin=""])',

    // Sponsored badge indicators (to filter out sponsored results)
    sponsoredBadge: [
      '[data-component-type="sp-sponsored-result"]',
      '.s-sponsored-label-info-icon',
      'span:contains("Sponsored")',
      '.AdHolder'
    ],

    // Product link within result
    productLink: 'a.a-link-normal.s-no-outline',

    // ASIN attribute
    asinAttribute: 'data-asin',

    // No results indicator
    noResults: '.s-no-results-message'
  },

  // Product Page Selectors
  product: {
    // Brand selectors (try in order)
    brand: [
      '#bylineInfo',
      'a#bylineInfo',
      '.po-brand .po-break-word',
      '#productDetails_techSpec_section_1 tr:contains("Brand") td',
      '#productDetails_detailBullets_sections1 tr:contains("Brand") td',
      '.a-spacing-small .a-size-base:contains("Brand")'
    ],

    // Rating selectors
    rating: [
      'span.a-icon-alt',
      '#acrPopover',
      '[data-action="acrStarsLink-click-metrics"] span.a-icon-alt'
    ],

    // Review count selectors
    reviewCount: [
      '#acrCustomerReviewText',
      '#averageCustomerReviews #acrCustomerReviewText',
      '[data-hook="total-review-count"]'
    ],

    // Product details table (for UPC, etc.)
    detailsTable: [
      '#productDetails_techSpec_section_1',
      '#productDetails_detailBullets_sections1',
      '#detailBullets_feature_div',
      '.detail-bullet-list'
    ],

    // UPC/EAN identifiers
    upcLabels: ['UPC', 'EAN', 'GTIN'],

    // Best Seller Rank selectors
    bsr: [
      '#productDetails_detailBullets_sections1 tr:contains("Best Sellers Rank") td',
      '#detailBulletsWrapper_feature_div li:contains("Best Sellers Rank")',
      '.a-list-item:contains("Best Sellers Rank")',
      '#SalesRank'
    ],

    // Product title
    title: [
      '#productTitle',
      'h1.a-size-large span'
    ],

    // Price
    price: [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole'
    ]
  },

  // URL patterns
  urls: {
    searchBase: 'https://www.amazon.com/s?k=',
    productBase: 'https://www.amazon.com/dp/'
  }
};
