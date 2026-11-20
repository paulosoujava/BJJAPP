const { contextBridge, ipcRenderer } = require('electron');

// Ponte entre a janela principal (operador) e a janela do telão.
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  sendState: (payload) => ipcRenderer.send('state:push', payload),
  onState: (cb) => ipcRenderer.on('state:update', (_e, payload) => cb(payload)),
  requestState: () => ipcRenderer.send('state:request'),
  onStateRequest: (cb) => ipcRenderer.on('state:request', () => cb()),
  openTelao: () => ipcRenderer.send('telao:open'),
  closeTelao: () => ipcRenderer.send('telao:close'),
  onHistory: (cb) => ipcRenderer.on('menu:history', () => cb()),
  onTelaoStatus: (cb) => ipcRenderer.on('telao:status', (_e, open) => cb(!!open))
});
