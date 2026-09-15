const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const {
  createSaleReturn,
  createPurchaseReturn,
  getSaleReturns,
  getPurchaseReturns
} = require('../controllers/returnController');

// All return routes require authentication
router.use(authRequired);

// Sales returns
router.post('/sale', createSaleReturn);
router.get('/sale', getSaleReturns);

// Purchase returns
router.post('/purchase', createPurchaseReturn);
router.get('/purchase', getPurchaseReturns);

module.exports = router;
