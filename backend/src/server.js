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
const grnRoutes = require('./routes/grnRoutes');
const accountRoutes = require('./routes/accountRoutes');
const backupService = require('./services/backupService');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database initialization promise
let initDbPromise = null;
function ensureDbInit() {
  if (!initDbPromise) {
    initDbPromise = initDb().then(() => {
      console.log(`Database (${isPostgres ? 'PostgreSQL' : 'SQLite'}) initialized successfully.`);
      if (!isPostgres) {
        backupService.createBackup('startup');
        backupService.startDailyScheduler();
      }
    }).catch(err => {
      console.error('Failed to initialize database:', err);
      initDbPromise = null;
      throw err;
    });
  }
  return initDbPromise;
}

// Trigger initialization immediately
ensureDbInit().catch(() => {});

// Middleware ensuring DB is ready for any /api request
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    try {
      await ensureDbInit();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Database initialization failed: ' + err.message });
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Unaib Computer Accessories POS API',
    timestamp: new Date().toISOString()
  });
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
app.use('/api/grn', grnRoutes);
app.use('/api/accounts', accountRoutes);

// Graceful shutdown backup and unhandled errors protection
let isShuttingDown = false;
function handleGracefulExit(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (!isPostgres) {
    console.log(`[Server] Received ${signal}. Taking safe shutdown backup...`);
    try {
      backupService.createBackup('shutdown');
    } catch (e) {
      console.error('[Server] Shutdown backup failed:', e.message);
    }
  }
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
