const express = require('express');
const router = express.Router();
const prodCtrl = require('../controllers/productController');
const { authRequired, adminOnly } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

// Product listing & search (accessible to cashier & admin)
router.get('/', authRequired, prodCtrl.getProducts);
router.get('/alerts/low-stock', authRequired, prodCtrl.getLowStockAlerts);
router.get('/alerts/oversold', authFlexible, prodCtrl.getOversoldAlerts);
router.post('/alerts/oversold/:id/resolve', authFlexible, prodCtrl.resolveOversoldAlert);
router.get('/barcode/:barcode', authRequired, prodCtrl.getProductByBarcode);
router.get('/:id', authRequired, prodCtrl.getProductById);

// Product modifications
router.post('/', authRequired, prodCtrl.createProduct);
router.put('/:id', authRequired, prodCtrl.updateProduct);
router.delete('/:id', authRequired, prodCtrl.deleteProduct);
router.post('/:id/sync-serials', authRequired, prodCtrl.syncProductSerials);

// Categories & Suppliers
router.get('/meta/categories', authRequired, prodCtrl.getCategories);
router.post('/meta/categories', authRequired, prodCtrl.createCategory);
router.get('/meta/suppliers', authRequired, prodCtrl.getSuppliers);
router.post('/meta/suppliers', authRequired, prodCtrl.createSupplier);

module.exports = router;
