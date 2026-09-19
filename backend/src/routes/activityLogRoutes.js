const express = require('express');
const router = express.Router();
const { authRequired, adminOnly } = require('../middleware/auth');
const { getLogs } = require('../models/ActivityLog');

/**
 * GET /api/activity-logs
 * Admin-only: Fetch activity audit trail logs with date and action filters
 */
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { startDate, endDate, action, limit, offset } = req.query;
    const logs = await getLogs({
      startDate,
      endDate,
      action,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
});

module.exports = router;
