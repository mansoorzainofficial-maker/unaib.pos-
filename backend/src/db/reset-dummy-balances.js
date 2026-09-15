const { getDb, initDb } = require('../config/db');

function resetBalancesAndDummyData() {
  initDb();
  const db = getDb();
  console.log('Resetting dummy customer/supplier balances and fake transactions...');
  db.exec('BEGIN TRANSACTION;');
  db.exec('UPDATE customers SET total_spent = 0.0, current_balance = 0.0;');
  db.exec('UPDATE suppliers SET current_balance = 0.0;');
  db.exec('DELETE FROM ledger_entries;');
  db.exec('DELETE FROM invoice_items;');
  db.exec('DELETE FROM invoices;');
  db.exec('DELETE FROM purchase_items;');
  db.exec('DELETE FROM purchases;');
  db.exec("UPDATE serial_numbers SET status = 'in_stock', customer_id = NULL, invoice_id = NULL, invoice_item_id = NULL, sold_date = NULL, warranty_expiry_date = NULL;");
  db.exec('COMMIT;');
  console.log('Successfully reset all balances to 0.00 and cleared dummy transaction history!');
}

if (require.main === module) {
  resetBalancesAndDummyData();
}

module.exports = { resetBalancesAndDummyData };
