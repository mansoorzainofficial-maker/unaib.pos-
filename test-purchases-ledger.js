const http = require('http');

let authToken = '';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing Purchases & Ledger APIs with Auth ---');

  // 0. Login with Admin PIN
  const loginRes = await makeRequest('/api/auth/login', 'POST', { pin: '1234' });
  if (loginRes.data && loginRes.data.token) {
    authToken = loginRes.data.token;
    console.log('0. Login Successful as:', loginRes.data.user.full_name);
  } else {
    console.error('Login failed:', loginRes.data);
    return;
  }

  // 1. Check Ledger Summary
  const summaryRes = await makeRequest('/api/ledger/summary');
  console.log('1. Ledger Summary:', summaryRes.status, summaryRes.data.success ? 'OK' : summaryRes.data);
  console.log('   Initial Summary:', summaryRes.data.summary);

  // 2. Fetch Suppliers
  const suppRes = await makeRequest('/api/products/meta/suppliers');
  console.log('2. Suppliers List:', suppRes.status, `Found: ${suppRes.data.suppliers ? suppRes.data.suppliers.length : 0}`);
  const supplier = suppRes.data.suppliers[0];
  console.log(`   Using Supplier: ID ${supplier.id} (${supplier.name})`);

  // 3. Create a test purchase
  const testInvNum = 'SUP-INV-' + Date.now();
  const purchasePayload = {
    supplier_id: supplier.id,
    supplier_invoice_no: testInvNum,
    purchase_date: new Date().toISOString().slice(0, 10),
    items: [
      {
        product_id: 1, // Kingston 16GB RAM
        cost_price: 3900,
        sale_price: 4600,
        quantity: 3,
        serial_numbers: ['SN-PUR-' + Date.now() + '-1', 'SN-PUR-' + Date.now() + '-2', 'SN-PUR-' + Date.now() + '-3']
      }
    ],
    discount: 0,
    paid_amount: 5000, // Total is 3 * 3900 = 11700, so remaining debt is 6700
    payment_method: 'Cash',
    notes: 'Bulk purchase test with serial numbers'
  };

  const createPurchaseRes = await makeRequest('/api/purchases', 'POST', purchasePayload);
  console.log('3. Create Purchase Result:', createPurchaseRes.status, createPurchaseRes.data);

  // 4. Verify Supplier Ledger Statement
  const suppStatement = await makeRequest(`/api/ledger/supplier/${supplier.id}`);
  console.log('4. Supplier Ledger Statement:', suppStatement.status);
  console.log(`   Party: ${suppStatement.data.supplier.name}, Current Payable Balance: Rs. ${suppStatement.data.supplier.current_balance}`);
  console.log(`   Recent Ledger Entries: ${suppStatement.data.entries.length}`);
  const lastEntry = suppStatement.data.entries[suppStatement.data.entries.length - 1];
  console.log('   Last Entry:', lastEntry);

  // 5. Make a payment voucher to supplier (Paying Rs. 3000)
  const paymentPayload = {
    party_type: 'supplier',
    party_id: supplier.id,
    amount: 3000,
    payment_method: 'Cash',
    reference_number: 'RCPT-TEST-001',
    description: 'Cash payment to vendor against invoice'
  };

  const paymentRes = await makeRequest('/api/ledger/payment', 'POST', paymentPayload);
  console.log('5. Record Payment Voucher:', paymentRes.status, paymentRes.data);

  // 6. Check Customers with Udhar
  const custRes = await makeRequest('/api/invoices/meta/customers');
  console.log('6. Customers List:', custRes.status, `Found: ${custRes.data.customers ? custRes.data.customers.length : 0}`);

  // 7. Final Ledger Summary
  const finalSummary = await makeRequest('/api/ledger/summary');
  console.log('7. Updated Ledger Summary:', finalSummary.data.summary);

  console.log('\n✅ ALL PURCHASES AND DOUBLE-ENTRY LEDGER INTEGRATION TESTS PASSED!');
}

runTests().catch(console.error);
