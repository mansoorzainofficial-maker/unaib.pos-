const express = require('express');
const router = express.Router();
const dashboardCtrl = require('../controllers/dashboardController');
const { authRequired } = require('../middleware/auth');

/**
 * GET /api/dashboard
 * Protected: Returns real-time business metrics for the dashboard landing page
 */
router.get('/', authRequired, dashboardCtrl.getDashboardOverview);

module.exports = router;
