const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (options) => ipcRenderer.invoke('print-receipt', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close')
});
