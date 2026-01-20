require('dotenv').config();
const path = require('path');

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,

  // Rate Limiting
  requestDelayMin: parseInt(process.env.REQUEST_DELAY_MIN, 10) || 6000,
  requestDelayMax: parseInt(process.env.REQUEST_DELAY_MAX, 10) || 10000,

  // Retries
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 2,

  // Storage
  storagePath: path.resolve(__dirname, '../../', process.env.STORAGE_PATH || '../storage'),
  uploadsPath: path.resolve(__dirname, '../../', process.env.STORAGE_PATH || '../storage', 'uploads'),
  resultsPath: path.resolve(__dirname, '../../', process.env.STORAGE_PATH || '../storage', 'results'),
  exportsPath: path.resolve(__dirname, '../../', process.env.STORAGE_PATH || '../storage', 'exports'),

  // CAPTCHA Pause
  captchaPauseMin: parseInt(process.env.CAPTCHA_PAUSE_MIN, 10) || 1800000,
  captchaPauseMax: parseInt(process.env.CAPTCHA_PAUSE_MAX, 10) || 3600000,
};

module.exports = config;
