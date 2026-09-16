const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authRequired } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

router.get('/', authFlexible, supplierController.getAllSuppliers);
router.get('/:id', authFlexible, supplierController.getSupplierById);
router.post('/', authFlexible, supplierController.createSupplier);
router.put('/:id', authFlexible, supplierController.updateSupplier);
router.delete('/:id', authFlexible, supplierController.deleteSupplier);

module.exports = router;
