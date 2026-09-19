const { run, query } = require('../config/db');

/**
 * Safe activity logger - records user events without ever throwing or breaking the primary request
 */
async function logActivity({ userId = null, username = 'System', action, description = '' }) {
  try {
    if (!action) return;
    await run(
      'INSERT INTO activity_log (user_id, username, action, description) VALUES (?, ?, ?, ?)',
      [userId, String(username || 'System'), String(action), String(description || '')]
    );
  } catch (err) {
    console.warn('[ActivityLog Warning] Failed to record log:', err.message);
  }
}

/**
 * Fetch activity logs with optional date range, action filter, and pagination
 */
async function getLogs({ startDate, endDate, action, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT id, user_id, username, action, description, created_at FROM activity_log WHERE 1=1';
  const params = [];

  if (startDate) {
    sql += ' AND created_at >= ?';
    const s = String(startDate).includes(' ') ? String(startDate) : `${startDate} 00:00:00`;
    params.push(s);
  }

  if (endDate) {
    sql += ' AND created_at <= ?';
    const e = String(endDate).includes(' ') ? String(endDate) : `${endDate} 23:59:59`;
    params.push(e);
  }

  if (action && action !== 'all') {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit) || 100, Number(offset) || 0);

  return await query(sql, params);
}

module.exports = {
  logActivity,
  getLogs
};
