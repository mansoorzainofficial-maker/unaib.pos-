const fs = require('fs');
const path = require('path');
const { getDb, DB_PATH } = require('../config/db');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../../backups');
const MAX_BACKUPS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Perform a safe atomic backup of the SQLite database
 * Naming format: backup-YYYY-MM-DD.sqlite (e.g. backup-2026-06-07.sqlite)
 * If file exists for today, appends timestamp: backup-YYYY-MM-DD_HH-mm-ss.sqlite
 */
function createBackup(trigger = 'startup') {
  try {
    ensureBackupDir();

    if (!fs.existsSync(DB_PATH)) {
      console.warn(`[BackupService] Source database not found at ${DB_PATH}`);
      return { success: false, message: 'Database file not found' };
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    // Standard naming: backup-YYYY-MM-DD.sqlite
    let filename = `backup-${dateStr}.sqlite`;
    let targetPath = path.join(BACKUP_DIR, filename);

    // If backup for today already exists, add time so multiple snapshots are preserved
    if (fs.existsSync(targetPath)) {
      filename = `backup-${dateStr}_${timeStr}.sqlite`;
      targetPath = path.join(BACKUP_DIR, filename);
    }

    // 1. Flush SQLite WAL journal buffer to main database file
    try {
      const db = getDb();
      db.exec('PRAGMA wal_checkpoint(FULL);');
    } catch (e) {
      console.warn('[BackupService] WAL checkpoint note:', e.message);
    }

    // 2. Perform safe atomic snapshot via VACUUM INTO, with copyFileSync fallback
    let copiedViaVacuum = false;
    try {
      const db = getDb();
      const escapedPath = targetPath.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedPath}';`);
      copiedViaVacuum = true;
    } catch (vacuumErr) {
      fs.copyFileSync(DB_PATH, targetPath);
    }

    const stat = fs.statSync(targetPath);
    console.log(`[BackupService] Backup created: ${filename} (${formatBytes(stat.size)}) [Trigger: ${trigger}]`);

    // 3. Keep latest maxKeep backups, clean older ones
    rotateBackups(MAX_BACKUPS);

    return {
      success: true,
      filename,
      filePath: targetPath,
      sizeBytes: stat.size,
      sizeFormatted: formatBytes(stat.size),
      trigger,
      createdAt: now.toISOString(),
      method: copiedViaVacuum ? 'vacuum' : 'copy'
    };
  } catch (err) {
    console.error('[BackupService] Backup failed:', err);
    return {
      success: false,
      message: err.message
    };
  }
}

/**
 * Remove older backups keeping only the latest maxKeep files
 */
function rotateBackups(maxKeep = MAX_BACKUPS) {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => (f.startsWith('backup-') || f.startsWith('unaib_pos_backup_')) && f.endsWith('.sqlite'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        return {
          filename: f,
          path: fullPath,
          time: fs.statSync(fullPath).mtimeMs
        };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
          console.log(`[BackupService] Rotated old backup: ${item.filename}`);
        } catch (e) {
          console.error(`[BackupService] Failed to delete ${item.filename}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('[BackupService] Rotation error:', err.message);
  }
}

/**
 * List all existing backups
 */
function listBackups() {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => (f.startsWith('backup-') || f.startsWith('unaib_pos_backup_')) && f.endsWith('.sqlite'))
      .map(f => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          filePath: fullPath,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: stat.mtime.toISOString(),
          timeMs: stat.mtimeMs
        };
      })
      .sort((a, b) => b.timeMs - a.timeMs);

    return {
      success: true,
      backupDir: BACKUP_DIR,
      count: files.length,
      backups: files
    };
  } catch (err) {
    return {
      success: false,
      backupDir: BACKUP_DIR,
      count: 0,
      backups: [],
      message: err.message
    };
  }
}

/**
 * Background scheduler: Takes an automated backup once a day
 */
function startDailyScheduler() {
  const CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes
  setInterval(() => {
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const existing = listBackups().backups.some(b => b.filename.includes(dateStr));
      if (!existing) {
        console.log(`[BackupService] Taking daily automated background backup for ${dateStr}...`);
        createBackup('daily_schedule');
      }
    } catch (e) {
      console.error('[BackupService] Daily scheduler error:', e.message);
    }
  }, CHECK_INTERVAL);
}

module.exports = {
  createBackup,
  listBackups,
  rotateBackups,
  startDailyScheduler,
  BACKUP_DIR
};
