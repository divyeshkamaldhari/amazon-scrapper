/**
 * Integration Tests for Amazon UPC Scraper
 *
 * Run with: node tests/integration.test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Simple test runner
 */
async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    results.tests.push({ name, status: 'PASSED' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAILED', error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Create a test Excel file
 */
function createTestExcel() {
  const XLSX = require('xlsx');

  const data = [
    { UPC: '012345678901', Brand: 'TestBrand1' },
    { UPC: '012345678902', Brand: 'TestBrand2' },
    { UPC: '012345678903', Brand: 'TestBrand3' }
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const testFilePath = path.join(__dirname, 'test-upcs.xlsx');
  XLSX.writeFile(wb, testFilePath);

  return testFilePath;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n========================================');
  console.log('  Amazon UPC Scraper Integration Tests');
  console.log('========================================\n');

  // Test 1: Health Check
  await test('API Health Check', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.status === 'ok', 'Expected status ok');
  });

  // Test 2: Get Jobs (empty initially)
  await test('Get Jobs List', async () => {
    const response = await axios.get(`${API_BASE}/jobs`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });

  // Test 3: Upload Excel File
  let jobId = null;
  await test('Upload Excel File', async () => {
    const testFilePath = createTestExcel();
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));

    const response = await axios.post(`${API_BASE}/jobs/upload`, form, {
      headers: form.getHeaders()
    });

    assert(response.status === 201, 'Expected status 201');
    assert(response.data.success === true, 'Expected success true');
    assert(response.data.data.jobId, 'Expected jobId');
    assert(response.data.data.totalUpcs === 3, 'Expected 3 UPCs');

    jobId = response.data.data.jobId;

    // Clean up test file
    fs.unlinkSync(testFilePath);
  });

  // Test 4: Get Job Details
  await test('Get Job Details', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    const response = await axios.get(`${API_BASE}/jobs/${jobId}`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.data.jobId === jobId, 'Expected matching jobId');
    assert(response.data.data.status === 'QUEUED', 'Expected QUEUED status');
    assert(response.data.data.totalUpcs === 3, 'Expected 3 UPCs');
  });

  // Test 5: Resume/Start Job
  await test('Start Job (Resume)', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    const response = await axios.post(`${API_BASE}/jobs/${jobId}/resume`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.data.status === 'RUNNING', 'Expected RUNNING status');
  });

  // Test 6: Check Job is Running
  await test('Check Job Running Status', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    // Wait a moment for job to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await axios.get(`${API_BASE}/jobs/${jobId}`);
    assert(response.status === 200, 'Expected status 200');
    assert(
      response.data.data.status === 'RUNNING' || response.data.data.status === 'COMPLETED',
      'Expected RUNNING or COMPLETED status'
    );
  });

  // Test 7: Pause Job
  await test('Pause Job', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    const jobResponse = await axios.get(`${API_BASE}/jobs/${jobId}`);
    if (jobResponse.data.data.status !== 'RUNNING') {
      console.log('  (Job not running, skipping pause test)');
      return;
    }

    const response = await axios.post(`${API_BASE}/jobs/${jobId}/pause`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.data.status === 'PAUSED', 'Expected PAUSED status');
  });

  // Test 8: Get Job Logs
  await test('Get Job Logs', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    const response = await axios.get(`${API_BASE}/jobs/${jobId}/logs`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.data.jobId === jobId, 'Expected matching jobId');
    assert(Array.isArray(response.data.data.logs), 'Expected logs array');
  });

  // Test 9: Get Non-existent Job (should 404)
  await test('Get Non-existent Job Returns 404', async () => {
    try {
      await axios.get(`${API_BASE}/jobs/JOB_NONEXISTENT`);
      throw new Error('Expected 404 error');
    } catch (error) {
      assert(error.response?.status === 404, 'Expected 404 status');
    }
  });

  // Test 10: Delete Job
  await test('Delete Job', async () => {
    if (!jobId) throw new Error('No jobId from previous test');

    // First pause if running
    const jobResponse = await axios.get(`${API_BASE}/jobs/${jobId}`);
    if (jobResponse.data.data.status === 'RUNNING') {
      await axios.post(`${API_BASE}/jobs/${jobId}/pause`);
    }

    const response = await axios.delete(`${API_BASE}/jobs/${jobId}`);
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
  });

  // Print Summary
  console.log('\n========================================');
  console.log('  Test Summary');
  console.log('========================================');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total:  ${results.tests.length}`);
  console.log('========================================\n');

  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log('');
  }

  return results.failed === 0;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
