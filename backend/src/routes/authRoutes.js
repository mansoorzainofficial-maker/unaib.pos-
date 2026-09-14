const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Public route for authentication
router.post('/login', authCtrl.login);

// Authenticated session check
router.get('/me', authRequired, authCtrl.getMe);

// Admin-only user management
router.get('/users', authRequired, adminOnly, authCtrl.getUsers);
router.post('/users', authRequired, adminOnly, authCtrl.createUser);
router.put('/users/:id', authRequired, adminOnly, authCtrl.updateUser);

module.exports = router;
