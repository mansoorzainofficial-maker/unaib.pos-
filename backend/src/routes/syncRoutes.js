const express = require('express');
const router = express.Router();
const { pingDb } = require('../config/db');

/**
 * GET /api/sync/status
 * In 100% Supabase mode: all database operations are real-time.
 * Keeps React frontend navbar status indicator green ("✓ Synced").
 */
router.get('/status', async (req, res) => {
  try {
    const health = await pingDb();
    return res.json({
      success: true,
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      lastSyncTime: new Date().toISOString(),
      cloudConfigured: true,
      database: 'postgresql (supabase)',
      latencyMs: health.latencyMs
    });
  } catch (err) {
    return res.json({
      success: false,
      isOnline: false,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      lastSyncTime: null,
      cloudConfigured: true,
      database: 'postgresql (supabase)',
      error: err.message
    });
  }
});

/**
 * POST /api/sync/trigger
 * Direct cloud mode: all writes are real-time, zero queue needed.
 */
router.post('/trigger', async (req, res) => {
  return res.json({
    success: true,
    result: {
      syncedCount: 0,
      message: 'Direct Supabase cloud mode active - all transactions write in real-time.'
    }
  });
});

module.exports = router;
