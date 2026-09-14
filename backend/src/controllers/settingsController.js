const { query, get, run, transaction } = require('../config/db');

/**
 * Get all shop settings
 */
function getSettings(req, res) {
  try {
    const rows = query('SELECT key, value FROM store_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update shop settings (Admin only)
 */
function updateSettings(req, res) {
  try {
    const settingsObj = req.body; // e.g. { store_name: "...", receipt_size: "58mm", ... }

    transaction(({ run }) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        run(`
          INSERT INTO store_settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `, [key, String(value)]);
      }
    });

    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getSettings,
  updateSettings
};
