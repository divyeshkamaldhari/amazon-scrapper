const { fetchPage, isCaptchaPage, isNotFoundPage } = require('./httpClient');
const { searchAmazon } = require('./searchScraper');
const { scrapeProductPage } = require('./productScraper');

module.exports = {
  fetchPage,
  isCaptchaPage,
  isNotFoundPage,
  searchAmazon,
  scrapeProductPage
};
