const express = require('express');
const router = express.Router();
const ledgerCtrl = require('../controllers/ledgerController');
const { authRequired } = require('../middleware/auth');

// Customer Statement of Account (Khata)
router.get('/customer/:id', authRequired, ledgerCtrl.getCustomerLedger);

// Supplier Statement of Account (Khata)
router.get('/supplier/:id', authRequired, ledgerCtrl.getSupplierLedger);

// Record payment received or payment made
router.post('/payment', authRequired, ledgerCtrl.recordPayment);

// Summary of receivables & payables
router.get('/summary', authRequired, ledgerCtrl.getLedgerSummary);

module.exports = router;
