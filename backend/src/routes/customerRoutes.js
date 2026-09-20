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

router.get('/', authFlexible, invCtrl.getCustomers);
router.get('/:id', authFlexible, async (req, res) => {
  try {
    const { get } = require('../config/db');
    const customer = await get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, customer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/', authFlexible, invCtrl.createCustomer);
router.put('/:id', authFlexible, invCtrl.updateCustomer);
router.delete('/:id', authFlexible, invCtrl.deleteCustomer);

module.exports = router;
