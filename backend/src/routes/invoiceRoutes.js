const express = require('express');
const router = express.Router();
const invCtrl = require('../controllers/invoiceController');
const { authRequired } = require('../middleware/auth');

// Create POS sale invoice (accessible to Cashier & Admin)
router.post('/', authRequired, invCtrl.createInvoice);

// List and search invoices
router.get('/', authRequired, invCtrl.getInvoices);

// List and create customers with balances
router.get('/meta/customers', authRequired, invCtrl.getCustomers);
router.post('/meta/customers', authRequired, invCtrl.createCustomer);

// Void / Cancel an invoice (restores stock, frees serials, adjusts khata)
router.post('/:id/void', authRequired, invCtrl.voidInvoice);

// Get single invoice with receipt details
router.get('/:identifier', authRequired, invCtrl.getInvoiceDetails);

module.exports = router;
