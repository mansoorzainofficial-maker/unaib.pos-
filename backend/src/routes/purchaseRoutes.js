const express = require('express');
const router = express.Router();
const purCtrl = require('../controllers/purchaseController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Create Purchase (Admin only or manager)
router.post('/', authRequired, adminOnly, purCtrl.createPurchase);

// List and view purchases
router.get('/', authRequired, purCtrl.getPurchases);
router.get('/:id', authRequired, purCtrl.getPurchaseDetails);

// Void / Return Purchase (Admin only)
router.post('/:id/void', authRequired, adminOnly, purCtrl.voidPurchase);

module.exports = router;
