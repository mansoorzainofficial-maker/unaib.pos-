const express = require('express');
const router = express.Router();
const invCtrl = require('../controllers/invoiceController');
const { authRequired } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

// Create POS sale invoice (accessible to Cashier & Admin, and offline sync)
router.post('/', authFlexible, invCtrl.createInvoice);

// List and search invoices
router.get('/', authFlexible, invCtrl.getInvoices);

// List and create customers with balances
router.get('/meta/customers', authFlexible, invCtrl.getCustomers);
router.post('/meta/customers', authRequired, invCtrl.createCustomer);

// Void / Cancel an invoice (restores stock, frees serials, adjusts khata)
router.post('/:id/void', authRequired, invCtrl.voidInvoice);

// Permanently delete an invoice
router.delete('/:id', authRequired, invCtrl.deleteInvoice);

// Get single invoice with receipt details
router.get('/:identifier', authFlexible, invCtrl.getInvoiceDetails);

module.exports = router;
