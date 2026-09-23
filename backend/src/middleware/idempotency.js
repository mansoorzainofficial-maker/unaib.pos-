const crypto = require('crypto');

// Set of request keys currently being processed (0ms microsecond concurrency lock)
const inFlightRequests = new Set();

// Map of requestKey -> timestamp when completed (sliding cooldown window)
const recentCompletedRequests = new Map();

// Cooldown period in milliseconds (2.5 seconds)
const COOLDOWN_WINDOW_MS = 2500;

/**
 * Generate a unique fingerprint for a mutating request
 */
function generateKey(req) {
  // Use user id if authenticated, else IP address
  const clientIdentifier = (req.user && req.user.id) ? `user_${req.user.id}` : (req.ip || 'anon');
  const method = req.method.toUpperCase();
  const url = (req.baseUrl || '') + (req.path || req.url);
  const idempotencyHeader = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || '';

  // Body hash
  let bodyHash = '';
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    try {
      bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    } catch {
      bodyHash = '';
    }
  }

  return `${clientIdentifier}:${method}:${url}:${idempotencyHeader}:${bodyHash}`;
}

/**
 * Express middleware to prevent double clicks and race condition duplicate requests
 */
function idempotencyMiddleware(req, res, next) {
  // Only guard mutating HTTP methods
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Bypass public auth/login routes so standard auth interactions aren't blocked
  const fullUrl = req.originalUrl || req.url || '';
  if (fullUrl.includes('/api/auth/login') || fullUrl.includes('/api/health')) {
    return next();
  }

  const key = generateKey(req);

  // 1. Check in-flight lock: another identical request is currently being processed right now
  if (inFlightRequests.has(key)) {
    return res.status(409).json({
      success: false,
      code: 'REQUEST_IN_FLIGHT',
      message: 'درخواست زیر عمل ہے، برائے مہربانی انتظار کریں (Request is already processing, please wait)'
    });
  }

  // 2. Check sliding cooldown: an identical request finished less than 2.5 seconds ago
  const lastFinishedTime = recentCompletedRequests.get(key);
  if (lastFinishedTime) {
    const elapsed = Date.now() - lastFinishedTime;
    if (elapsed < COOLDOWN_WINDOW_MS) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_REQUEST_BLOCKED',
        message: 'ڈپلیکیٹ درخواست بلاک کر دی گئی ہے، برائے مہربانی بار بار کلک نہ کریں (Duplicate action blocked, please do not click repeatedly)'
      });
    }
  }

  // Acquire in-flight lock
  inFlightRequests.add(key);

  // Hook into response finish / close to release in-flight and set cooldown
  let released = false;
  const releaseLock = () => {
    if (released) return;
    released = true;
    inFlightRequests.delete(key);
    // Record completion timestamp
    recentCompletedRequests.set(key, Date.now());

    // Schedule cleanup of memory after cooldown + 1s buffer
    const timer = setTimeout(() => {
      recentCompletedRequests.delete(key);
    }, COOLDOWN_WINDOW_MS + 1000);
    if (timer.unref) timer.unref();
  };

  res.once('finish', releaseLock);
  res.once('close', releaseLock);

  next();
}

module.exports = {
  idempotencyMiddleware,
  inFlightRequests,
  recentCompletedRequests,
  COOLDOWN_WINDOW_MS
};
