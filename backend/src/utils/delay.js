const config = require('../config');

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for a random duration between min and max
 * @param {number} min - Minimum milliseconds
 * @param {number} max - Maximum milliseconds
 * @returns {Promise<number>} Actual delay used
 */
async function randomDelay(min = config.requestDelayMin, max = config.requestDelayMax) {
  const delayMs = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`[DELAY] Waiting ${delayMs}ms`);
  await delay(delayMs);
  return delayMs;
}

/**
 * Delay between search and product page requests (5-7 seconds)
 */
async function searchToProductDelay() {
  return randomDelay(5000, 7000);
}

/**
 * Delay between product page requests (5-7 seconds)
 */
async function productToProductDelay() {
  return randomDelay(5000, 7000);
}

/**
 * Delay between UPC processing (6-10 seconds)
 */
async function upcToUpcDelay() {
  return randomDelay(config.requestDelayMin, config.requestDelayMax);
}

/**
 * CAPTCHA pause delay (30-60 minutes)
 */
async function captchaPauseDelay() {
  const min = config.captchaPauseMin || 1800000; // 30 min
  const max = config.captchaPauseMax || 3600000; // 60 min
  const delayMs = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`[DELAY] CAPTCHA pause: waiting ${Math.round(delayMs / 60000)} minutes`);
  await delay(delayMs);
  return delayMs;
}

module.exports = {
  delay,
  randomDelay,
  searchToProductDelay,
  productToProductDelay,
  upcToUpcDelay,
  captchaPauseDelay
};
