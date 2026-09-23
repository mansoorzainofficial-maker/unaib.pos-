const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, isPostgres } = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const cashDrawerRoutes = require('./routes/cashDrawerRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const backupRoutes = require('./routes/backupRoutes');
const printerRoutes = require('./routes/printerRoutes');
const returnRoutes = require('./routes/returnRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const customerRoutes = require('./routes/customerRoutes');
const grnRoutes = require('./routes/grnRoutes');
const accountRoutes = require('./routes/accountRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const syncRoutes = require('./routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Strict Privacy & Anti-Leak: Disable caching on all API responses
// Prevents Chromium disk cache, browser memory, or proxies from retaining sensitive ledger, customer, or sales records
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// System-wide Idempotency & Double-Click / Rapid-Tap Concurrency Protection
const { idempotencyMiddleware } = require('./middleware/idempotency');
app.use('/api', idempotencyMiddleware);

// Database initialization promise
let initDbPromise = null;
let isDbReady = false;

function ensureDbInit() {
  if (isDbReady) return Promise.resolve();
  if (!initDbPromise) {
    initDbPromise = initDb().then(() => {
      isDbReady = true;
      console.log('Database (PostgreSQL - Supabase) initialized successfully.');
    }).catch(err => {
      console.error('Failed to initialize database:', err);
      initDbPromise = null;
      isDbReady = false;
      throw err;
    });
  }
  return initDbPromise;
}

// Trigger initialization immediately in background
ensureDbInit().catch(() => {});

// Middleware ensuring DB is ready for any /api request (fast 0ms bypass once ready)
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    if (!isDbReady) {
      try {
        await ensureDbInit();
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: 'DatabaseInitError',
          message: 'Database initialization failed: ' + err.message
        });
      }
    }
  }
  next();
});

// Root /api endpoint: explicitly defines the API and returns service catalog
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    success: true,
    service: 'Unaib Computer Accessories POS API',
    status: 'online',
    message: 'Unaib POS Cloud API is defined and running successfully',
    version: '1.0.0',
    documentation: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      invoices: '/api/invoices',
      grn: '/api/grn',
      ledger: '/api/ledger',
      suppliers: '/api/suppliers',
      customers: '/api/customers',
      accounts: '/api/accounts',
      reports: '/api/reports',
      expenses: '/api/expenses',
      drawer: '/api/drawer',
      settings: '/api/settings',
      activity_logs: '/api/activity-logs',
      dashboard: '/api/dashboard'
    },
    timestamp: new Date().toISOString()
  });
});

// Comprehensive Health check endpoint with live database ping & latency verification
app.get('/api/health', async (req, res) => {
  const { pingDb, CURRENT_SCHEMA_VERSION } = require('./config/db');
  try {
    const dbHealth = await pingDb();
    res.json({
      status: 'ok',
      service: 'Unaib Computer Accessories POS API',
      database: 'postgresql (supabase)',
      db_status: 'connected',
      db_latency_ms: dbHealth.latencyMs,
      schema_version: CURRENT_SCHEMA_VERSION,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'Unaib Computer Accessories POS API',
      database: 'postgresql (supabase)',
      db_status: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/drawer', cashDrawerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/grn', grnRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);

// Catch-all 404 handler for undefined /api routes: ALWAYS returns JSON, NEVER HTML!
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `API endpoint '${req.method} ${req.originalUrl}' does not exist`
  });
});

// Global API error handler ensuring all exceptions are cleanly serialized as JSON
app.use('/api', (err, req, res, next) => {
  console.error('[API Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An internal server error occurred'
  });
});

// Graceful shutdown backup and unhandled errors protection
let isShuttingDown = false;
function handleGracefulExit(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.exit(0);
}

process.on('SIGINT', () => handleGracefulExit('SIGINT'));
process.on('SIGTERM', () => handleGracefulExit('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Server Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Serve static production frontend build from dist folder
const staticDistPath = path.join(__dirname, '../../dist');
app.use(express.static(staticDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(staticDistPath, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  }
  next();
});

let serverInstance = null;

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    serverInstance = app.listen(port, () => {
      console.log(`Unaib POS Backend Server running on http://localhost:${port}`);
      resolve(serverInstance);
    });
    serverInstance.on('error', reject);
  });
}

// If run directly via node backend/src/server.js
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
