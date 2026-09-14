const express = require('express');
const router = express.Router();
const repCtrl = require('../controllers/reportController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Financial reports - strictly protected for Admin only
router.get('/summary', authRequired, adminOnly, repCtrl.getFinancialSummary);
router.get('/tax', authRequired, adminOnly, repCtrl.getTaxReport);

module.exports = router;
