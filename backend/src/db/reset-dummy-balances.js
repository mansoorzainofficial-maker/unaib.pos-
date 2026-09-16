const { getDb, initDb } = require('../config/db');

function resetBalancesAndDummyData() {
  initDb();
  const db = getDb();
  console.log('Resetting dummy customer/supplier balances and fake transactions...');
  db.exec('BEGIN TRANSACTION;');

  // 1. Reset balances on parties
  db.exec('UPDATE customers SET total_spent = 0.0, current_balance = 0.0;');
  db.exec('UPDATE suppliers SET current_balance = 0.0, total_due = 0.0;');

  // 2. Remove all test suppliers created during automated testing
  db.exec("DELETE FROM suppliers WHERE name LIKE 'Test Tech Supplier%' OR name LIKE 'Test%';");

  // 3. Clear all transactional line items and headers
  db.exec('DELETE FROM invoice_items;');
  db.exec('DELETE FROM invoices;');
  db.exec('DELETE FROM purchase_items;');
  db.exec('DELETE FROM purchases;');
  db.exec('DELETE FROM sales_return_items;');
  db.exec('DELETE FROM sales_returns;');
  db.exec('DELETE FROM purchase_return_items;');
  db.exec('DELETE FROM purchase_returns;');
  db.exec('DELETE FROM grn_items;');
  db.exec('DELETE FROM grn;');

  // 4. Clear ledgers, cash drawer sessions, transactions, expenses, and alerts
  db.exec('DELETE FROM ledger_entries;');
  db.exec('DELETE FROM transactions;');
  db.exec('DELETE FROM cash_drawers;');
  db.exec('DELETE FROM expenses;');
  db.exec('DELETE FROM stock_alerts;');
  db.exec('DELETE FROM warranty_claims;');
  db.exec('DELETE FROM serial_numbers;');

  // 5. Reset product stock quantities to 0 (clean state awaiting fresh GRNs/purchases)
  db.exec('UPDATE products SET stock_quantity = 0;');

  // 6. Reset SQLite auto-increment counters for fresh sequential numbering
  try {
    db.exec(`
      DELETE FROM sqlite_sequence WHERE name IN (
        'invoices', 'invoice_items', 'purchases', 'purchase_items',
        'sales_returns', 'sales_return_items', 'purchase_returns', 'purchase_return_items',
        'grn', 'grn_items', 'ledger_entries', 'transactions', 'expenses',
        'cash_drawers', 'stock_alerts', 'warranty_claims', 'serial_numbers'
      );
    `);
  } catch (_) {}

  db.exec('COMMIT;');

  // 7. Flush WAL checkpoint and vacuum database for compact size
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.exec('VACUUM;');
  } catch (err) {
    console.warn('Vacuum notice:', err.message);
  }

  console.log('Successfully reset all balances to 0.00 and cleared all test/dummy transaction history!');
}

if (require.main === module) {
  resetBalancesAndDummyData();
}

module.exports = { resetBalancesAndDummyData };
