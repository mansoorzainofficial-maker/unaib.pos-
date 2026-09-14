const express = require('express');
const router = express.Router();
const drawerCtrl = require('../controllers/cashDrawerController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Cashier drawer actions
router.get('/current', authRequired, drawerCtrl.getCurrentShift);
router.post('/open', authRequired, drawerCtrl.openShift);
router.post('/close', authRequired, drawerCtrl.closeShift);

// History (Admin only or manager audit)
router.get('/history', authRequired, adminOnly, drawerCtrl.getShiftHistory);

module.exports = router;
