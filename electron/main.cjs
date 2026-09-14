const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const BACKEND_PORT = process.env.PORT || 5001;

function checkServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/settings`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureBackendServer() {
  const isRunning = await checkServerReady(BACKEND_PORT);
  if (isRunning) {
    console.log(`Backend server already active on port ${BACKEND_PORT}`);
    return;
  }

  console.log(`Starting backend server on port ${BACKEND_PORT}...`);
  const serverScript = path.join(__dirname, '../backend/src/server.js');
  serverProcess = spawn('node', [serverScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    stdio: 'ignore'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to spawn backend process:', err);
  });

  // Wait for server to become responsive
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const ready = await checkServerReady(BACKEND_PORT);
    if (ready) {
      console.log('Backend server is live and responsive.');
      return;
    }
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Unaib Computer Accessories - POS & Management System',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Remove default menu for a professional native POS look
  mainWindow.setMenuBarVisibility(false);

  if (isDev && process.env.VITE_DEV === 'true') {
    // In development mode with Vite hot-reload
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Load directly from local backend server which serves compiled React dist
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`).catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Thermal Printer IPC handlers with timeout & hardware error protection
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (e) {
    console.error('Error fetching printers:', e.message);
    return [];
  }
});

ipcMain.handle('print-receipt', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  try {
    const printOptions = {
      silent: options.silent || false,
      printBackground: true,
      deviceName: options.deviceName || '',
      margins: {
        marginType: 'none'
      },
      pageSize: options.pageSize || 'Letter'
    };

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: 'Printer response timed out. Make sure the thermal printer is powered on and connected via USB.'
          });
        }
      }, 15000);

      try {
        mainWindow.webContents.print(printOptions, (success, failureReason) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            if (!success) {
              const isCancelled = failureReason && (failureReason.toLowerCase().includes('cancel') || failureReason.toLowerCase().includes('abort'));
              resolve({
                success: false,
                cancelled: isCancelled,
                error: failureReason || 'Printer error: Device offline or disconnected'
              });
            } else {
              resolve({ success: true });
            }
          }
        });
      } catch (printErr) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          resolve({ success: false, error: printErr.message });
        }
      }
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('open-url', async (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL' };
});

ipcMain.handle('open-path', async (event, targetPath) => {
  try {
    if (targetPath) {
      const err = await shell.openPath(targetPath);
      if (err) return { success: false, error: err };
      return { success: true };
    }
    return { success: false, error: 'No path specified' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(async () => {
  await ensureBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  try {
    console.log('[Electron] Application shutting down. Triggering exit backup...');
    const backupService = require('../backend/src/services/backupService');
    backupService.createBackup('app_exit');
  } catch (err) {
    console.error('[Electron] Exit backup error:', err.message);
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
