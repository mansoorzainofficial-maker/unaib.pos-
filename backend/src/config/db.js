const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Database file path - supports local desktop and Vercel serverless environment
function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL) {
    const tmpDb = '/tmp/unaib_pos.sqlite';
    const originalDb = path.join(__dirname, '../../../unaib_pos.sqlite');
    try {
      if (fs.existsSync(originalDb)) {
        const origStat = fs.statSync(originalDb);
        const tmpExists = fs.existsSync(tmpDb);
        if (!tmpExists || fs.statSync(tmpDb).size !== origStat.size || fs.statSync(tmpDb).mtimeMs < origStat.mtimeMs) {
          fs.copyFileSync(originalDb, tmpDb);
          console.log('Successfully synced fresh DB from repository to /tmp');
        }
      }
    } catch (err) {
      console.error('Failed syncing SQLite DB to /tmp:', err.message);
    }
    return tmpDb;
  }
  return path.join(__dirname, '../../../unaib_pos.sqlite');
}

const DB_PATH = resolveDbPath();

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    // Performance optimizations for high-speed POS
    try {
      dbInstance.exec('PRAGMA journal_mode = WAL;');
      dbInstance.exec('PRAGMA synchronous = NORMAL;');
      dbInstance.exec('PRAGMA foreign_keys = ON;');
    } catch (e) {
      console.warn('Pragma setup notice:', e.message);
    }
  }
  return dbInstance;
}

/**
 * Execute a query returning multiple rows
 */
function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
  // Clone object from null prototype for clean JSON serialization
  return rows.map(r => ({ ...r }));
}

/**
 * Execute a query returning a single row
 */
function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
  return row ? { ...row } : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE
 * Returns { changes, lastInsertRowid }
 */
function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const res = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
  return {
    changes: res.changes,
    lastInsertRowid: Number(res.lastInsertRowid)
  };
}

/**
 * Execute multiple raw SQL statements
 */
function exec(sql) {
  const db = getDb();
  return db.exec(sql);
}

/**
 * Run operations inside an ACID transaction
 */
function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = fn({ query, get, run, exec });
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Initialize schema if not exists
 */
function initDb() {
  const db = getDb();
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }
  
  // Check if users exist, if not seed database
  const userCount = get('SELECT COUNT(*) as cnt FROM users');
  if (!userCount || userCount.cnt === 0) {
    console.log('Database empty. Running initial seed...');
    const { seed } = require('../db/seed');
    seed();
  }

  // Safe schema migrations for Void / Cancel feature
  try {
    const invCols = query("PRAGMA table_info(invoices)").map(c => c.name);
    if (!invCols.includes('void_reason')) {
      db.exec("ALTER TABLE invoices ADD COLUMN void_reason TEXT;");
    }
    if (!invCols.includes('voided_at')) {
      db.exec("ALTER TABLE invoices ADD COLUMN voided_at DATETIME;");
    }
    if (!invCols.includes('voided_by')) {
      db.exec("ALTER TABLE invoices ADD COLUMN voided_by INTEGER REFERENCES users(id);");
    }
    if (!invCols.includes('previous_customer_balance')) {
      db.exec("ALTER TABLE invoices ADD COLUMN previous_customer_balance REAL DEFAULT 0.0;");
    }
    if (!invCols.includes('new_customer_balance')) {
      db.exec("ALTER TABLE invoices ADD COLUMN new_customer_balance REAL DEFAULT 0.0;");
    }
  } catch (migErr) {
    console.warn('Schema migration check warning:', migErr.message);
  }

  // Safe schema migrations for Purchases Tax & Supplier Balances
  try {
    const purCols = query("PRAGMA table_info(purchases)").map(c => c.name);
    if (!purCols.includes('tax_rate')) {
      db.exec("ALTER TABLE purchases ADD COLUMN tax_rate REAL DEFAULT 0.0;");
    }
    if (!purCols.includes('tax_amount')) {
      db.exec("ALTER TABLE purchases ADD COLUMN tax_amount REAL DEFAULT 0.0;");
    }
    if (!purCols.includes('previous_supplier_balance')) {
      db.exec("ALTER TABLE purchases ADD COLUMN previous_supplier_balance REAL DEFAULT 0.0;");
    }
    if (!purCols.includes('new_supplier_balance')) {
      db.exec("ALTER TABLE purchases ADD COLUMN new_supplier_balance REAL DEFAULT 0.0;");
    }
    if (!purCols.includes('status')) {
      db.exec("ALTER TABLE purchases ADD COLUMN status TEXT DEFAULT 'completed';");
    }
    if (!purCols.includes('void_reason')) {
      db.exec("ALTER TABLE purchases ADD COLUMN void_reason TEXT;");
    }
    if (!purCols.includes('voided_at')) {
      db.exec("ALTER TABLE purchases ADD COLUMN voided_at DATETIME;");
    }
    if (!purCols.includes('voided_by')) {
      db.exec("ALTER TABLE purchases ADD COLUMN voided_by INTEGER REFERENCES users(id);");
    }
  } catch (purMigErr) {
    console.warn('Purchases migration check warning:', purMigErr.message);
  }

  // Safe schema migrations for Returns (Sale & Purchase Returns)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
        invoice_number TEXT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT,
        customer_phone TEXT,
        refund_mode TEXT NOT NULL DEFAULT 'cash',
        total_refund_amount REAL NOT NULL DEFAULT 0.0,
        reason TEXT,
        cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        serial_numbers TEXT
      );

      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
        purchase_number TEXT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        supplier_name TEXT,
        total_amount REAL NOT NULL DEFAULT 0.0,
        refund_mode TEXT NOT NULL DEFAULT 'deduct_balance',
        reason TEXT,
        cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_cost REAL NOT NULL,
        total_amount REAL NOT NULL
      );
    `);
  } catch (retErr) {
    console.warn('Returns schema migration warning:', retErr.message);
  }
}

module.exports = {
  getDb,
  query,
  get,
  run,
  exec,
  transaction,
  initDb,
  DB_PATH
};
