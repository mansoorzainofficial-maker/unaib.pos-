const express = require('express');
const router = express.Router();
const syncService = require('../services/syncService');

/**
 * GET /api/sync/status
 * Returns current sync status, pending count, online state, latency, and last sync timestamp
 */
router.get('/status', async (req, res) => {
  try {
    const status = await syncService.getSyncStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/sync/trigger
 * Manually trigger immediate background sync
 */
router.post('/trigger', async (req, res) => {
  try {
    // Process queue in background and return immediate progress result
    const result = await syncService.processQueue();
    return res.json({
      success: true,
      result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
