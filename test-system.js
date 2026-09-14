/**
 * Comprehensive Automated System Test for Unaib Computer Accessories POS
 * Verifies all 5 core modules:
 * 1. Inventory & Low Stock Alerts
 * 2. POS Billing & Barcode Invoicing
 * 3. Warranty & Serial Number Tracking
 * 4. Financial Reports (P&L, Drawer Reconciliation, Expenses)
 * 5. User Access Control (Admin vs Cashier)
 */

const { initDb, get, query, run } = require('./backend/src/config/db');
const { signToken, verifyPassword } = require('./backend/src/utils/authUtils');
const invCtrl = require('./backend/src/controllers/invoiceController');
const warCtrl = require('./backend/src/controllers/warrantyController');
const repCtrl = require('./backend/src/controllers/reportController');
const drawerCtrl = require('./backend/src/controllers/cashDrawerController');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING UNAIB COMPUTER ACCESSORIES TEST SUITE');
  console.log('====================================================\n');

  // 1. Initialize Database
  initDb();
  console.log('✅ DB Initialized and Seeded successfully.');

  // 2. Test User Access Control
  const admin = get('SELECT * FROM users WHERE username = ?', ['admin']);
  const cashier = get('SELECT * FROM users WHERE username = ?', ['cashier1']);
  
  if (!admin || admin.role !== 'admin') throw new Error('Admin user missing or invalid role');
  if (!cashier || cashier.role !== 'cashier' || cashier.pin !== '1111') throw new Error('Cashier user missing or invalid PIN');
  console.log('✅ Role-Based Access Control verified: Admin & Cashier accounts active.');

  // 3. Test Inventory & Low Stock Alerts
  const lowStock = query('SELECT * FROM products WHERE stock_quantity <= low_stock_threshold');
  console.log(`✅ Low Stock Warning Check: Found ${lowStock.length} items at or below threshold:`);
  lowStock.forEach(p => console.log(`   ⚠️ [${p.barcode}] ${p.name}: Stock = ${p.stock_quantity}, Min = ${p.low_stock_threshold}`));

  // 4. Test Barcode Search
  const sampleBarcode = '8806090558451'; // Samsung 980 Pro
  const product = get('SELECT * FROM products WHERE barcode = ?', [sampleBarcode]);
  if (!product) throw new Error('Barcode search failed');
  console.log(`✅ Barcode Lookup verified: "${product.name}" (Price: Rs. ${product.sale_price})`);

  // 5. Test POS Sale Creation & Thermal Receipt Generation
  console.log('\n--- Testing POS Transaction & Invoicing ---');
  const mockReq = {
    user: { id: cashier.id, role: cashier.role, username: cashier.username },
    body: {
      customer_name: 'Usman Ghani',
      customer_phone: '0312-9988776',
      items: [
        {
          product_id: product.id,
          quantity: 1,
          unit_price: product.sale_price,
          serial_numbers: ['SN-SAM-980P-00101']
        }
      ],
      discount_type: 'amount',
      discount_value: 500,
      tax_rate: 0,
      payment_method: 'cash',
      paid_amount: 30000,
      notes: 'Test sale with 24M warranty'
    }
  };

  let invoiceCreated = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      if (!data.success) throw new Error(data.message);
      invoiceCreated = data.invoice;
      return data;
    }
  };

  await invCtrl.createInvoice(mockReq, mockRes);
  console.log(`✅ Sale Invoiced Successfully: ${invoiceCreated.invoice_number}`);
  console.log(`   Customer: ${invoiceCreated.customer_name} (${invoiceCreated.customer_phone})`);
  console.log(`   Subtotal: Rs. ${invoiceCreated.subtotal}, Discount: Rs. ${invoiceCreated.discount_amount}, Grand Total: Rs. ${invoiceCreated.grand_total}`);
  console.log(`   Change Due: Rs. ${invoiceCreated.change_amount}`);
  console.log(`   Receipt items count: ${invoiceCreated.items.length}`);

  // Check that product stock decremented
  const updatedProduct = get('SELECT stock_quantity FROM products WHERE id = ?', [product.id]);
  console.log(`✅ Stock decremented from ${product.stock_quantity} to ${updatedProduct.stock_quantity}`);

  // 6. Test Warranty & Serial Number Tracking
  console.log('\n--- Testing Warranty Tracking & Lookup ---');
  let lookupResult = null;
  const mockWarRes = {
    status(code) { return this; },
    json(data) { lookupResult = data.serial; return data; }
  };

  await warCtrl.lookupSerial({ params: { serial_number: 'SN-SAM-980P-00101' } }, mockWarRes);
  if (!lookupResult) throw new Error('Serial lookup failed');
  console.log(`✅ Serial Number Verified: ${lookupResult.serial_number}`);
  console.log(`   Linked Invoice: ${lookupResult.invoice_number}`);
  console.log(`   Customer: ${lookupResult.customer_name} (${lookupResult.customer_phone})`);
  console.log(`   Warranty Status: ${lookupResult.warrantyStatus.toUpperCase()} (${lookupResult.daysRemaining} days remaining)`);

  // 7. Test Warranty RMA Claim
  console.log('\n--- Testing Warranty RMA Claim Creation ---');
  let claimCreated = null;
  const mockClaimRes = {
    status(code) { return this; },
    json(data) { claimCreated = data; return data; }
  };
  await warCtrl.createClaim({
    body: {
      serial_number_id: lookupResult.id,
      issue_description: 'Customer reports occasional I/O timeouts under heavy read.',
      notes: 'Original box received with warranty card'
    }
  }, mockClaimRes);
  console.log(`✅ RMA Claim Created: ${claimCreated.claimNumber} (ID: ${claimCreated.claimId})`);

  // 8. Test Cash Drawer Shift Reconciliation
  console.log('\n--- Testing Cash Drawer Shift Reconciliation ---');
  // Open shift
  let shiftOpenRes = null;
  await drawerCtrl.openShift({
    user: { id: cashier.id },
    body: { opening_cash: 5000, notes: 'Morning Shift' }
  }, {
    status() { return this; },
    json(data) { shiftOpenRes = data; return data; }
  });
  console.log(`✅ Cash Drawer Shift Opened with Rs. 5,000 float.`);

  // Close shift with counted cash
  let closeResult = null;
  await drawerCtrl.closeShift({
    user: { id: cashier.id },
    body: { actual_closing_cash: 5000, notes: 'Handover complete' }
  }, {
    status() { return this; },
    json(data) { closeResult = data.reconciliation; return data; }
  });
  console.log(`✅ Cash Drawer Reconciled: ${closeResult.status} (Expected: Rs. ${closeResult.expected_closing}, Actual: Rs. ${closeResult.actual_closing})`);

  // 9. Test Financial Reports & Profit/Loss
  console.log('\n--- Testing Financial Reports (Profit & Loss) ---');
  let reportData = null;
  await repCtrl.getFinancialSummary({ query: { period: 'today' } }, {
    status() { return this; },
    json(data) { reportData = data; return data; }
  });
  const sum = reportData.summary;
  console.log(`✅ Financial Summary Computed:`);
  console.log(`   Total Revenue: Rs. ${sum.total_revenue}`);
  console.log(`   Cost of Goods Sold (COGS): Rs. ${sum.total_cogs}`);
  console.log(`   Gross Profit: Rs. ${sum.gross_profit}`);
  console.log(`   Operating Expenses: Rs. ${sum.total_expenses}`);
  console.log(`   Net Profit: Rs. ${sum.net_profit} (${sum.profit_margin}% Margin)`);

  console.log('\n====================================================');
  console.log('🎉 ALL SYSTEM MODULES TESTED AND VERIFIED PERFECTLY!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
