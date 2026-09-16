const { getDb } = require('../config/db');
const db = getDb();

const defaultCashAcc = db.prepare("SELECT id FROM accounts WHERE type = 'cash' LIMIT 1").get();
if (defaultCashAcc) {
  db.prepare("UPDATE ledger_entries SET account_id = ? WHERE account_id IS NULL AND payment_method = 'cash'").run(defaultCashAcc.id);
  console.log('Linked existing cash entries to default account:', defaultCashAcc.id);
}
console.log('Done migration.');
