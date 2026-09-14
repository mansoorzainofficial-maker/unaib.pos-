const express = require('express');
const router = express.Router();
const warCtrl = require('../controllers/warrantyController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Lookup serial number status and history (Cashier & Admin)
router.get('/lookup/:serial_number', authRequired, warCtrl.lookupSerial);

// List serial numbers
router.get('/serials', authRequired, warCtrl.getSerialNumbers);

// Add serial numbers to stock (Admin only)
router.post('/serials', authRequired, adminOnly, warCtrl.addSerialsToStock);

// Warranty claims / RMA management
router.get('/claims', authRequired, warCtrl.getClaims);
router.post('/claims', authRequired, warCtrl.createClaim);
router.put('/claims/:id', authRequired, warCtrl.updateClaimStatus);

module.exports = router;
