/**
 * Automated Pre-Deploy Endpoint Test Suite
 * Validates that all expected API routes respond with 200 and clean JSON,
 * and verifies that non-existent routes return 404 JSON (zero HTML error pages).
 */

const { startServer } = require('./src/server');
const { signToken } = require('./src/utils/authUtils');
const http = require('http');

const TEST_PORT = 5099;

async function runTestSuite() {
  console.log('====================================================');
  console.log('   UNAIB POS - PRE-DEPLOY ENDPOINT TEST SUITE');
  console.log('====================================================\n');

  let server;
  try {
    server = await startServer(TEST_PORT);
    console.log(`✓ Test server running on http://127.0.0.1:${TEST_PORT}\n`);
  } catch (err) {
    console.error('Failed to boot test server:', err.message);
    process.exit(1);
  }

  const token = signToken({ id: 1, username: 'admin', role: 'admin' });
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const tests = [
    { method: 'GET', path: '/api/health', expectedStatus: 200, auth: false },
    { method: 'GET', path: '/api/auth/me', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/dashboard', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/products', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/products/meta/categories', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/products/meta/suppliers', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/invoices', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/invoices/meta/customers', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/suppliers', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/ledger/accounts', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/ledger/parties', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/ledger/summary', expectedStatus: 200, auth: true }, // Verified fix!
    { method: 'GET', path: '/api/accounts', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/expenses', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/purchases', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/returns/sale', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/returns/purchase', expectedStatus: 200, auth: true },
    { method: 'GET', path: '/api/warranty/serials', expectedStatus: 200, auth: true },
    // Negative test: non-existent route MUST return 404 JSON, NOT HTML!
    { method: 'GET', path: '/api/non-existent-probe-test', expectedStatus: 404, auth: false, expectJson404: true }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const url = `http://127.0.0.1:${TEST_PORT}${t.path}`;
    const reqHeaders = t.auth ? headers : { 'Content-Type': 'application/json' };

    try {
      const res = await fetch(url, { method: t.method, headers: reqHeaders });
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data = null;

      const isJson = contentType.includes('application/json');
      if (isJson) {
        try {
          data = JSON.parse(text);
        } catch (_) {}
      }

      const statusMatch = res.status === t.expectedStatus;
      const jsonMatch = isJson && data !== null;

      if (statusMatch && jsonMatch) {
        console.log(`  [PASS] ${t.method} ${t.path} -> HTTP ${res.status} (Valid JSON)`);
        passed++;
      } else {
        console.error(`  [FAIL] ${t.method} ${t.path}`);
        console.error(`         Expected status: ${t.expectedStatus}, Got: ${res.status}`);
        console.error(`         Content-Type: ${contentType} (Expected application/json)`);
        if (!isJson) {
          console.error(`         Raw Body (HTML leak!): ${text.slice(0, 150)}`);
        }
        failed++;
      }
    } catch (err) {
      console.error(`  [FAIL] ${t.method} ${t.path} -> Exception: ${err.message}`);
      failed++;
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (server && server.close) {
    server.close();
  }

  if (failed > 0) {
    console.error('\n❌ Pre-Deploy test suite failed. Fix errors before deploying.');
    process.exit(1);
  } else {
    console.log('\n✅ All endpoints verified: 100% JSON compliant, Zero HTML leaks, All routes functional.');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
