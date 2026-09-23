const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Safely load .env from backend/.env or root .env (never hardcoded, never committed)
try {
  const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    ...(process.resourcesPath ? [
      path.join(process.resourcesPath, '.env'),
      path.join(process.resourcesPath, 'backend/.env')
    ] : [])
  ];
  for (const ep of envPaths) {
    if (ep && fs.existsSync(ep)) {
      require('dotenv').config({ path: ep });
    }
  }
} catch (_) {}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) {
  console.error('[FATAL] DATABASE_URL is missing in environment variables. Pure Supabase operation requires DATABASE_URL.');
}

// -------------------------------------------------------------
// PostgreSQL Type Parsers (Preserve JavaScript types and accuracy)
// -------------------------------------------------------------
// 1. NUMERIC / DECIMAL (OID 1700) -> Convert to JavaScript float
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// 2. BIGINT / INT8 (OID 20) -> Convert to JavaScript integer
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));

// 3. FLOAT4 (OID 700) & FLOAT8 (OID 701) -> Convert to JavaScript float
types.setTypeParser(700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(701, (val) => (val === null ? null : parseFloat(val)));

// 4. DATE (OID 1082) -> Return raw 'YYYY-MM-DD' string (Prevents unwanted UTC timezone shifts)
types.setTypeParser(1082, (val) => val);

// Centralized Supabase Connection Pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

pgPool.on('error', (err) => {
  console.error('[pgPool Error]', err.message);
});

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
 * Execute operation with exponential backoff auto-retry on transient network failure
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
 * Transforms standard parameterized SQL into PostgreSQL SQL
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
 * Execute a query returning multiple rows from Supabase
 */
async function query(sql, params = []) {
  const res = await withRetry(() => pgPool.query(toPostgresSql(sql), params));
  return res.rows;
}

/**
 * Execute a query returning a single row from Supabase
 */
async function get(sql, params = []) {
  const res = await withRetry(() => pgPool.query(toPostgresSql(sql), params));
  return res.rows[0] || null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE on Supabase
 * Returns { changes, lastInsertRowid } identical to expected controller interface
 */
async function run(sql, params = []) {
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

/**
 * Execute raw SQL statement(s) on Supabase
 */
async function exec(sql) {
  return await withRetry(() => pgPool.query(sql));
}

/**
 * Run operations inside an ACID transaction on Supabase
 */
async function transaction(fn) {
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
}

/**
 * Actively ping Supabase to verify connection health and latency
 */
async function pingDb() {
  const start = Date.now();
  await withRetry(() => pgPool.query('SELECT 1'));
  return { healthy: true, latencyMs: Date.now() - start };
}

function getPgPool() {
  return pgPool;
}

const CURRENT_SCHEMA_VERSION = '2026_09_v4';
let isSchemaInitialized = false;

/**
 * Initialize and verify Supabase PostgreSQL connection
 */
async function initDb() {
  if (isSchemaInitialized) {
    return;
  }
  const health = await pingDb();
  console.log(`✓ Supabase PostgreSQL connected successfully (${health.latencyMs}ms latency).`);
  isSchemaInitialized = true;
}

// Deprecation guard for any legacy callers
function getDb() {
  throw new Error('SQLite has been removed. Unaib POS runs 100% on Supabase PostgreSQL.');
}

module.exports = {
  query,
  get,
  run,
  exec,
  transaction,
  pingDb,
  pingCloudDb: pingDb,
  getPgPool,
  initDb,
  getDb,
  isPostgres: true,
  CURRENT_SCHEMA_VERSION
};
