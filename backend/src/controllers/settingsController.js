const { query, get, run, transaction } = require('../config/db');

/**
 * Get all shop settings
 */
async function getSettings(req, res) {
  try {
    const rows = await query('SELECT key, value FROM store_settings');
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
async function updateSettings(req, res) {
  try {
    const settingsObj = req.body;

    await transaction(async ({ run: txRun }) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        await txRun(`
          INSERT INTO store_settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
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
