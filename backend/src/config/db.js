const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Database file path - supports local desktop and Vercel serverless environment
function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL) {
    const tmpDb = '/tmp/unaib_pos.sqlite';
    const originalDb = path.join(__dirname, '../../../unaib_pos.sqlite');
    if (!fs.existsSync(tmpDb) && fs.existsSync(originalDb)) {
      try {
        fs.copyFileSync(originalDb, tmpDb);
      } catch (err) {
        console.error('Failed copying SQLite DB to /tmp:', err.message);
      }
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
