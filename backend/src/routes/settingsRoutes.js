const express = require('express');
const router = express.Router();
const setCtrl = require('../controllers/settingsController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Public settings for UI & receipts
router.get('/', setCtrl.getSettings);

// Update settings (Admin only)
router.put('/', authRequired, adminOnly, setCtrl.updateSettings);

module.exports = router;
