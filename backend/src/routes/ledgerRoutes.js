const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');
const { authRequired } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

router.get('/accounts', authFlexible, ledgerController.getAccounts);
router.get('/parties', authFlexible, ledgerController.getParties);
router.get('/statement', authFlexible, ledgerController.getStatement);
router.post('/payment', authFlexible, ledgerController.recordPayment);

// Missing endpoints required by frontend & reports
router.get('/summary', authFlexible, ledgerController.getSummary);
router.get('/customer/:id', authFlexible, ledgerController.getCustomerStatement);
router.get('/supplier/:id', authFlexible, ledgerController.getSupplierStatement);

module.exports = router;
