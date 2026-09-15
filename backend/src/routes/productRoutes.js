const express = require('express');
const router = express.Router();
const prodCtrl = require('../controllers/productController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Product listing & search (accessible to cashier & admin)
router.get('/', authRequired, prodCtrl.getProducts);
router.get('/alerts/low-stock', authRequired, prodCtrl.getLowStockAlerts);
router.get('/barcode/:barcode', authRequired, prodCtrl.getProductByBarcode);
router.get('/:id', authRequired, prodCtrl.getProductById);

// Product modifications
router.post('/', authRequired, prodCtrl.createProduct);
router.put('/:id', authRequired, adminOnly, prodCtrl.updateProduct);
router.delete('/:id', authRequired, adminOnly, prodCtrl.deleteProduct);
router.post('/:id/sync-serials', authRequired, adminOnly, prodCtrl.syncProductSerials);

// Categories & Suppliers
router.get('/meta/categories', authRequired, prodCtrl.getCategories);
router.post('/meta/categories', authRequired, prodCtrl.createCategory);
router.get('/meta/suppliers', authRequired, prodCtrl.getSuppliers);
router.post('/meta/suppliers', authRequired, prodCtrl.createSupplier);

module.exports = router;
