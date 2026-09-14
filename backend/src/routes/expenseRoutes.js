const express = require('express');
const router = express.Router();
const expCtrl = require('../controllers/expenseController');
const { authRequired, adminOnly } = require('../middleware/auth');

// List expenses
router.get('/', authRequired, expCtrl.getExpenses);

// Create expense (Cashier or Admin recording a shop expense)
router.post('/', authRequired, expCtrl.createExpense);

// Delete expense (Admin only)
router.delete('/:id', authRequired, adminOnly, expCtrl.deleteExpense);

module.exports = router;
