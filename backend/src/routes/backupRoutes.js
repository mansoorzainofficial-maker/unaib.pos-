const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const backupService = require('../services/backupService');
const { exec } = require('child_process');

// List backups
router.get('/', authRequired, (req, res) => {
  const result = backupService.listBackups();
  return res.json(result);
});

// Create manual backup
router.post('/', authRequired, (req, res) => {
  const trigger = req.body?.trigger || 'manual';
  const result = backupService.createBackup(trigger);
  if (!result.success) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

// Open backup folder in Windows Explorer
router.post('/open-folder', authRequired, (req, res) => {
  try {
    const dir = backupService.BACKUP_DIR;
    if (process.platform === 'win32') {
      exec(`explorer.exe "${dir}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${dir}"`);
    } else {
      exec(`xdg-open "${dir}"`);
    }
    return res.json({ success: true, message: 'Opened backup directory', path: dir });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
