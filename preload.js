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
  netStart: () => ipcRenderer.invoke('net:start'),
  netStop: () => ipcRenderer.invoke('net:stop'),
  netInfo: () => ipcRenderer.invoke('net:info'),
  netPin: () => ipcRenderer.invoke('net:pin'),
  qr: (t) => ipcRenderer.invoke('net:qr', t),
  onMesa: (cb) => ipcRenderer.on('net:mesa', (_e, b) => cb(b)),
  quit: () => ipcRenderer.send('app:quit'),
  onCloseRequest: (cb) => ipcRenderer.on('app:close-request', () => cb()),
  confirmClose: () => ipcRenderer.send('app:close-confirm'),
  cancelClose: () => ipcRenderer.send('app:close-cancel'),
  licStatus: () => ipcRenderer.invoke('lic:status'),
  licActivate: (k) => ipcRenderer.invoke('lic:activate', k),
  checkUpdate: () => ipcRenderer.invoke('app:update-check'),
  openExternal: (u) => ipcRenderer.send('app:open-external', u),
  onHistory: (cb) => ipcRenderer.on('menu:history', () => cb()),
  onTelaoStatus: (cb) => ipcRenderer.on('telao:status', (_e, open) => cb(!!open))
});
