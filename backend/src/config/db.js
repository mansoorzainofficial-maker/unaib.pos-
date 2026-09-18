const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Safely load local .env from backend/.env or root .env (never hardcoded, never committed)
try {
  const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env')
  ];
  for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
      require('dotenv').config({ path: ep });
    }
  }
} catch (_) {}

// Check if PostgreSQL (Supabase) is configured via environment variable
const isPostgres = process.env.FORCE_SQLITE === 'true'
  ? false
  : Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);

let pgPool = null;

if (isPostgres) {
  const { Pool, types } = require('pg');

  // 1. NUMERIC / DECIMAL (OID 1700) -> Convert to JavaScript float
  types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

  // 2. BIGINT / INT8 (OID 20) -> Convert to JavaScript integer
  types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

  // 3. FLOAT4 (OID 700) & FLOAT8 (OID 701) -> Convert to JavaScript float
  types.setTypeParser(700, (val) => (val === null ? null : parseFloat(val)));
  types.setTypeParser(701, (val) => (val === null ? null : parseFloat(val)));

  // 4. DATE (OID 1082) -> Return raw 'YYYY-MM-DD' string (Prevents unwanted UTC timezone shifts)
  types.setTypeParser(1082, (val) => val);

  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pgPool.on('error', (err) => {
    console.error('[pgPool Error]', err.message);
  });
}

// Database file path - supports local desktop SQLite
function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(__dirname, '../../../unaib_pos.sqlite');
}

const DB_PATH = resolveDbPath();
let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
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
 * Transforms SQLite SQL into PostgreSQL SQL
 * 1. Converts ? placeholders to $1, $2, ...
 * 2. Converts DATE('now') to CURRENT_DATE
 * 3. Converts LIKE ... COLLATE NOCASE and LIKE to ILIKE
 * 4. Strips remaining COLLATE NOCASE
 */
function toPostgresSql(sql) {
  let idx = 1;
  let pgSql = sql.replace(/\?/g, () => `$${idx++}`);
  pgSql = pgSql.replace(/\bDATE\(\s*['"]now['"]\s*\)/gi, 'CURRENT_DATE');
  pgSql = pgSql.replace(/\bLIKE\b(?:\s+COLLATE\s+NOCASE)?/gi, 'ILIKE');
  pgSql = pgSql.replace(/\bCOLLATE\s+NOCASE\b/gi, '');
  return pgSql;
}

/**
 * Execute a query returning multiple rows
 */
async function query(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(toPostgresSql(sql), params);
    return res.rows;
  }
  const db = getDb();
  const stmt = db.prepare(sql);
  const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
  return rows.map(r => ({ ...r }));
}

/**
 * Execute a query returning a single row
 */
async function get(sql, params = []) {
  if (isPostgres) {
    const res = await pgPool.query(toPostgresSql(sql), params);
    return res.rows[0] || null;
  }
  const db = getDb();
  const stmt = db.prepare(sql);
  const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
  return row ? { ...row } : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE
 * Returns { changes, lastInsertRowid }
 */
async function run(sql, params = []) {
  if (isPostgres) {
    let pgSql = toPostgresSql(sql.trim());
    const isInsert = /^\s*insert\s+into/i.test(pgSql);
    if (isInsert && !/returning\s+/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const res = await pgPool.query(pgSql, params);
    const lastId = res.rows.length > 0 && res.rows[0].id ? Number(res.rows[0].id) : null;
    return {
      changes: res.rowCount,
      lastInsertRowid: lastId
    };
  }
  const db = getDb();
  const stmt = db.prepare(sql);
  const res = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
  return {
    changes: res.changes,
    lastInsertRowid: Number(res.lastInsertRowid)
  };
}

/**
 * Execute raw SQL statement(s)
 */
async function exec(sql) {
  if (isPostgres) {
    return await pgPool.query(sql);
  }
  const db = getDb();
  return db.exec(sql);
}

/**
 * Run operations inside an ACID transaction
 */
async function transaction(fn) {
  if (isPostgres) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const txQuery = async (sql, params = []) => {
        const res = await client.query(toPostgresSql(sql), params);
        return res.rows;
      };

      const txGet = async (sql, params = []) => {
        const res = await client.query(toPostgresSql(sql), params);
        return res.rows[0] || null;
      };

      const txRun = async (sql, params = []) => {
        let pgSql = toPostgresSql(sql.trim());
        const isInsert = /^\s*insert\s+into/i.test(pgSql);
        if (isInsert && !/returning\s+/i.test(pgSql)) {
          pgSql += ' RETURNING id';
        }
        const res = await client.query(pgSql, params);
        const lastId = res.rows.length > 0 && res.rows[0].id ? Number(res.rows[0].id) : null;
        return { changes: res.rowCount, lastInsertRowid: lastId };
      };

      const txExec = async (sql) => {
        return await client.query(sql);
      };

      const result = await fn({ query: txQuery, get: txGet, run: txRun, exec: txExec });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    // SQLite local synchronous transaction
    const db = getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const result = await fn({ query, get, run, exec });
      db.exec('COMMIT;');
      return result;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

/**
 * Initialize schema if not exists
 */
async function initDb() {
  if (isPostgres) {
    const schemaPath = path.join(__dirname, '../db/schema.postgres.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await exec(schemaSql);
      console.log('Supabase PostgreSQL schema initialized / verified.');
    }
    try {
      await exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS show_previous_balance INTEGER DEFAULT 1;");
      await exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12, 2) DEFAULT 0.0;");
      await exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_notes TEXT;");
      console.log('✓ Supabase PostgreSQL: show_previous_balance, shipping_cost & shipping_notes verified in invoices.');
    } catch (pgErr) {
      console.warn('Postgres migration warning:', pgErr.message);
    }
    return;
  }

  // SQLite Initialization
  const db = getDb();
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }
  
  const userCount = await get('SELECT COUNT(*) as cnt FROM users');
  if (!userCount || userCount.cnt === 0) {
    console.log('Database empty. Running initial seed...');
    const { seed } = require('../db/seed');
    seed();
  }

  // Safe schema migrations for Void / Cancel / Balance / Shipping feature
  try {
    const invCols = (await query("PRAGMA table_info(invoices)")).map(c => c.name);
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
    if (!invCols.includes('show_previous_balance')) {
      db.exec("ALTER TABLE invoices ADD COLUMN show_previous_balance INTEGER DEFAULT 1;");
      console.log("✓ SQLite: show_previous_balance column auto-added to invoices table.");
    }
    if (!invCols.includes('shipping_cost')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_cost REAL DEFAULT 0.0;");
      console.log("✓ SQLite: shipping_cost column auto-added to invoices table.");
    }
    if (!invCols.includes('shipping_notes')) {
      db.exec("ALTER TABLE invoices ADD COLUMN shipping_notes TEXT;");
      console.log("✓ SQLite: shipping_notes column auto-added to invoices table.");
    }
  } catch (migErr) {
    console.warn('Schema migration check warning:', migErr.message);
  }

  // Safe schema migrations for Purchases Tax & Supplier Balances
  try {
    const purCols = (await query("PRAGMA table_info(purchases)")).map(c => c.name);
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

      CREATE TABLE IF NOT EXISTS stock_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
        invoice_number TEXT,
        available_before REAL DEFAULT 0.0,
        quantity_sold REAL NOT NULL DEFAULT 1,
        quantity_oversold REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by INTEGER REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
    `);
  } catch (retErr) {
    console.warn('Returns and stock_alerts schema migration warning:', retErr.message);
  }

  try {
    db.exec('ALTER TABLE serial_numbers ADD COLUMN purchase_item_id INTEGER REFERENCES purchase_items(id) ON DELETE SET NULL;');
  } catch (snErr) {
    // Column already exists, ignore
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
  DB_PATH,
  isPostgres,
  toPostgresSql
};
