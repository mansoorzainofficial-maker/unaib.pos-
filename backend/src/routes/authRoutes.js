const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authCtrl = require('../controllers/authController');
const { authRequired, adminOnly } = require('../middleware/auth');

// Rate limiting for login: max 5 failed attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes lockout window
  max: 5, // 5 attempts
  skipSuccessfulRequests: true, // Do not penalize successful logins
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    message: 'بہت زیادہ غلط کوششیں۔ سیکیورٹی وجوہات کی بنا پر اکاؤنٹ ۱۵ منٹ کے لیے عارضی طور پر بلاک کر دیا گیا ہے۔ (Too many failed login attempts. Please try again after 15 minutes.)'
  }
});

// Public route for authentication (protected by rate limiter)
router.post('/login', loginLimiter, authCtrl.login);

// Authenticated session check
router.get('/me', authRequired, authCtrl.getMe);

// Admin-only user management
router.get('/users', authRequired, adminOnly, authCtrl.getUsers);
router.post('/users', authRequired, adminOnly, authCtrl.createUser);
router.put('/users/:id', authRequired, adminOnly, authCtrl.updateUser);

module.exports = router;
