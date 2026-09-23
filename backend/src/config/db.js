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

// Local-First Architecture:
// Desktop POS defaults to SQLite (isPostgres = false) for ultra-fast 1-5ms zero-latency writes.
// Supabase (pgPool) is used exclusively by the background sync worker.
// On Vercel / serverless cloud environments (where local disk is ephemeral), isPostgres = true.
const isVercel = Boolean(process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NOW_REGION);
const isPostgres = process.env.FORCE_POSTGRES === 'true'
  ? true
  : (process.env.FORCE_SQLITE === 'true' ? false : isVercel);

let pgPool = null;

// Initialize Supabase pool if DATABASE_URL is available (for cloud sync worker or direct cloud mode)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
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
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });

  pgPool.on('error', (err) => {
    console.error('[pgPool Error]', err.message);
  });
}

/**
 * Determine if a database error is transient and safe to auto-retry
 */
function isTransientDbError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08006' ||
    code === '08001' ||
    code === '08004' ||
    msg.includes('connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('unexpectedly') ||
    msg.includes('socket closed') ||
    msg.includes('client has encountered a connection error')
  );
}

/**
 * Execute operation with exponential backoff auto-retry on transient failure
 */
async function withRetry(operation, maxRetries = 2, baseDelay = 200) {
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === maxRetries) {
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 50;
      console.warn(`[pgPool Warning] Transient DB error (${err.message}). Retrying query (attempt ${attempt + 1}/${maxRetries}) in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Actively ping database to verify health and report latency
 */
async function pingDb() {
  const start = Date.now();
  if (isPostgres) {
    await withRetry(() => pgPool.query('SELECT 1'));
  } else {
    const db = getDb();
    db.prepare('SELECT 1').get();
  }
  return { healthy: true, latencyMs: Date.now() - start };
}

function getPgPool() {
  return pgPool;
}

/**
 * Actively ping cloud Supabase database without affecting local queries
 */
async function pingCloudDb() {
  if (!pgPool) return { connected: false, reason: 'No DATABASE_URL configured' };
  try {
    const start = Date.now();
    await withRetry(() => pgPool.query('SELECT 1'), 1, 150);
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
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
    const res = await withRetry(() => pgPool.query(toPostgresSql(sql), params));
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
    const res = await withRetry(() => pgPool.query(toPostgresSql(sql), params));
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
    const res = await withRetry(() => pgPool.query(pgSql, params));
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
    return await withRetry(() => pgPool.query(sql));
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

const CURRENT_SCHEMA_VERSION = '2026_09_v4';
let isSchemaInitialized = false;

/**
 * Run PostgreSQL migrations safely in background or cloud startup
 */
async function migratePostgresSchema() {
  if (!pgPool) return;
  try {
    await withRetry(() => pgPool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `));
    const verCheck = await withRetry(() => pgPool.query('SELECT version FROM schema_migrations WHERE version = $1', [CURRENT_SCHEMA_VERSION]));
    if (verCheck.rows.length > 0) {
      return;
    }

    console.log(`[DB Migration] Applying PostgreSQL schema migration for version ${CURRENT_SCHEMA_VERSION}...`);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id BIGSERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id VARCHAR(100) NOT NULL,
        action VARCHAR(20) NOT NULL CHECK(action IN ('insert', 'update', 'delete')),
        payload JSONB,
        retry_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed', 'synced')),
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, id);
    `);

    const syncTables = ['invoices', 'products', 'customers', 'suppliers', 'ledger_entries', 'purchases', 'sales_returns', 'expenses'];
    for (const tbl of syncTables) {
      try {
        await pgPool.query(`
          ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending';
          ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS local_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
          ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS server_id VARCHAR(100);
        `);
      } catch (tblErr) {
        console.warn(`Postgres sync column warning for ${tbl}:`, tblErr.message);
      }
    }

    await withRetry(() => pgPool.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING;', [CURRENT_SCHEMA_VERSION]));
    console.log(`✓ Recorded successful PostgreSQL schema version: ${CURRENT_SCHEMA_VERSION}`);
  } catch (err) {
    console.warn('PostgreSQL migration warning:', err.message);
  }
}

/**
 * Initialize schema if not exists with version tracking
 */
async function initDb() {
  if (isSchemaInitialized) {
    return; // Instant 0ms bypass on warm serverless and repeated invocations
  }

  if (isPostgres) {
    // 1. Fast version check: Has this migration version already been applied?
    try {
      await withRetry(() => pgPool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(100) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `));
      const verCheck = await withRetry(() => pgPool.query('SELECT version FROM schema_migrations WHERE version = $1', [CURRENT_SCHEMA_VERSION]));
      if (verCheck.rows.length > 0) {
        isSchemaInitialized = true;
        console.log(`✓ PostgreSQL Schema is current (${CURRENT_SCHEMA_VERSION}). Skipping 417-line DDL scan.`);
        return;
      }
    } catch (checkErr) {
      console.warn('Migration version check notice:', checkErr.message);
    }

    console.log(`[DB Migration] Applying one-time schema migration for version ${CURRENT_SCHEMA_VERSION}...`);
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
      await exec("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS extra_charges NUMERIC(12, 2) DEFAULT 0.0;");
      await exec("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12, 2) DEFAULT 0.0;");
      await exec(`
        CREATE TABLE IF NOT EXISTS accounts_ledger (
          id BIGSERIAL PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          entry_type VARCHAR(50) NOT NULL,
          reference_no VARCHAR(100),
          debit NUMERIC(12, 2) DEFAULT 0.0,
          credit NUMERIC(12, 2) DEFAULT 0.0,
          balance_after NUMERIC(12, 2) DEFAULT 0.0,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS activity_log (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          username VARCHAR(100),
          action VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
      `);
      // Sync identity sequences after seeding with explicit IDs
      try {
        await exec("SELECT setval(pg_get_serial_sequence('accounts', 'id'), COALESCE((SELECT MAX(id) FROM accounts), 1));");
        await exec("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));");
      } catch (seqErr) {
        console.warn('Postgres sequence sync warning:', seqErr.message);
      }
      console.log('✓ Supabase PostgreSQL: show_previous_balance, shipping, accounts & activity_log verified.');
    } catch (pgErr) {
      console.warn('Postgres migration warning:', pgErr.message);
    }

    // Apply sync_queue and sync columns on Supabase
    await migratePostgresSchema();

    try {
      await withRetry(() => pgPool.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING;', [CURRENT_SCHEMA_VERSION]));
      console.log(`✓ Recorded successful schema version: ${CURRENT_SCHEMA_VERSION}`);
    } catch (recErr) {
      console.warn('Failed to record migration version:', recErr.message);
    }

    isSchemaInitialized = true;
    return;
  }

  // SQLite Initialization
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const row = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(CURRENT_SCHEMA_VERSION);
    if (row) {
      isSchemaInitialized = true;
      console.log(`✓ SQLite Schema is current (${CURRENT_SCHEMA_VERSION}). Skipping full DDL scan.`);
      return;
    }
  } catch (_) {}

  console.log(`[SQLite Migration] Applying one-time schema migration for version ${CURRENT_SCHEMA_VERSION}...`);
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

  // Safe schema migrations for Void / Cancel / Balance / Shipping / Extra Charges feature
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
    if (!invCols.includes('extra_charges')) {
      db.exec("ALTER TABLE invoices ADD COLUMN extra_charges REAL DEFAULT 0.0;");
      console.log("✓ SQLite: extra_charges column auto-added to invoices table.");
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

  // Safe schema migrations for Goods Received Note (GRN) and Suppliers total_due
  try {
    // 1. Ensure total_due exists in suppliers
    const suppCols = (db.prepare('PRAGMA table_info(suppliers)').all() || []).map(c => c.name);
    if (!suppCols.includes('total_due')) {
      db.exec('ALTER TABLE suppliers ADD COLUMN total_due REAL NOT NULL DEFAULT 0.0;');
      db.exec('UPDATE suppliers SET total_due = current_balance WHERE current_balance IS NOT NULL;');
      console.log('✓ SQLite: total_due column auto-added to suppliers table.');
    }

    // 2. Ensure grn header table exists
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

    // 3. Ensure grn_items table exists
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

    // 4. Ensure transactions table exists
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
    console.log('✓ SQLite: GRN and transactions tables verified.');
  } catch (grnMigErr) {
    console.warn('GRN schema migration warning:', grnMigErr.message);
  }

  // Safe schema migrations for Financial Accounts current_balance and accounts_ledger
  try {
    const accCols = (await query("PRAGMA table_info(accounts)")).map(c => c.name);
    if (!accCols.includes('current_balance')) {
      db.exec("ALTER TABLE accounts ADD COLUMN current_balance REAL DEFAULT 0.0;");
      console.log("✓ SQLite: current_balance column auto-added to accounts table.");
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        entry_type TEXT NOT NULL,
        reference_no TEXT,
        debit REAL DEFAULT 0.0,
        credit REAL DEFAULT 0.0,
        balance_after REAL DEFAULT 0.0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        action TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
    `);
  } catch (accMigErr) {
    console.warn('Accounts & Activity log schema migration warning:', accMigErr.message);
  }

  // Safe schema migrations for Local-First Sync Queue and sync tracking columns
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('insert', 'update', 'delete')),
        payload TEXT,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed', 'synced')),
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, id);
    `);

    const syncTables = ['invoices', 'products', 'customers', 'suppliers', 'ledger_entries', 'purchases', 'sales_returns', 'expenses'];
    for (const tbl of syncTables) {
      try {
        const cols = (db.prepare(`PRAGMA table_info(${tbl})`).all() || []).map(c => c.name);
        if (!cols.includes('sync_status')) {
          db.exec(`ALTER TABLE ${tbl} ADD COLUMN sync_status TEXT DEFAULT 'pending';`);
        }
        if (!cols.includes('local_updated_at')) {
          db.exec(`ALTER TABLE ${tbl} ADD COLUMN local_updated_at DATETIME;`);
          db.exec(`UPDATE ${tbl} SET local_updated_at = CURRENT_TIMESTAMP WHERE local_updated_at IS NULL;`);
        }
        if (!cols.includes('server_id')) {
          db.exec(`ALTER TABLE ${tbl} ADD COLUMN server_id TEXT;`);
        }
      } catch (colErr) {
        console.warn(`SQLite sync column warning for ${tbl}:`, colErr.message);
      }
    }
    console.log("✓ SQLite: sync_queue table and sync columns verified.");
  } catch (syncMigErr) {
    console.warn('SQLite sync schema migration warning:', syncMigErr.message);
  }

  // Also trigger cloud schema migration in background if pgPool is configured
  if (pgPool) {
    migratePostgresSchema().catch(err => {
      console.warn('[Sync Worker] Background cloud schema migration deferred:', err.message);
    });
  }

  // Record successful migration in SQLite
  try {
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(CURRENT_SCHEMA_VERSION);
    console.log(`✓ Recorded successful SQLite schema version: ${CURRENT_SCHEMA_VERSION}`);
  } catch (migRecErr) {
    console.warn('Failed to record SQLite migration version:', migRecErr.message);
  }

  isSchemaInitialized = true;
}

module.exports = {
  getDb,
  query,
  get,
  run,
  exec,
  transaction,
  initDb,
  pingDb,
  pingCloudDb,
  getPgPool,
  migratePostgresSchema,
  CURRENT_SCHEMA_VERSION,
  DB_PATH,
  isPostgres,
  toPostgresSql
};
