const { getDb } = require('../config/db');
const db = getDb();

// 1. Ensure total_due exists in suppliers
const suppCols = db.prepare('PRAGMA table_info(suppliers)').all();
const hasTotalDue = suppCols.some(c => c.name === 'total_due');
if (!hasTotalDue) {
  db.exec('ALTER TABLE suppliers ADD COLUMN total_due REAL NOT NULL DEFAULT 0.0;');
  db.exec('UPDATE suppliers SET total_due = current_balance WHERE current_balance IS NOT NULL;');
  console.log('Added total_due column to suppliers and synced balance.');
} else {
  console.log('total_due already exists in suppliers.');
}

// 2. Create grn table
db.exec(`
CREATE TABLE IF NOT EXISTS grn (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    total_amount REAL NOT NULL DEFAULT 0.0,
    payment_type TEXT NOT NULL CHECK(payment_type IN ('cash', 'credit')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'pending', 'cancelled')),
    received_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_grn_number ON grn(grn_number);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON grn(supplier_id);
`);
console.log('Verified grn table.');

// 3. Create grn_items table
db.exec(`
CREATE TABLE IF NOT EXISTS grn_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id INTEGER NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_ordered INTEGER NOT NULL DEFAULT 1,
    quantity_received INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    total_cost REAL NOT NULL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON grn_items(grn_id);
`);
console.log('Verified grn_items table.');

// 4. Create transactions table
db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    reference_id INTEGER,
    reference_type TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_cat ON transactions(category);
`);
console.log('Verified transactions table.');
