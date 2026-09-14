const { verifyToken } = require('../utils/authUtils');

/**
 * Middleware: Verify user is authenticated
 */
function authRequired(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  req.user = payload;
  next();
}

/**
 * Middleware: Strictly require Admin role
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Admin privileges required for this action.'
    });
  }
  next();
}

module.exports = {
  authRequired,
  adminOnly
};
