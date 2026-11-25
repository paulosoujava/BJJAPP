const { app, BrowserWindow, Menu, shell, nativeTheme, powerSaveBlocker, ipcMain, screen } = require('electron');
const path = require('path');
const { createNet } = require('./net-server');
const license = require('./license');
const PUB = require('./license-pub');
let QR = null;
try { QR = require('qrcode'); } catch (e) {}
const net = createNet({ appDir: path.join(__dirname, 'app') });
net.onMesa = (b) => { sendToMain('net:mesa', b); return { ok: true }; };

// Mantém os dados salvos das versões anteriores (antes o app se chamava Chaveador Jiu-Jitsu).
app.setName('BJJ Arena');
app.setPath('userData', path.join(app.getPath('appData'), 'Chaveador Jiu-Jitsu'));

let mainWin = null;
let telaoWin = null;
let lastState = null;
let forceClose = false;
let wantQuit = false;

const webPrefs = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false
});

function sendToMain(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

function lockLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createWindow() {
  forceClose = false;
  mainWin = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'BJJ Arena',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1316' : '#ECEFF1',
    webPreferences: webPrefs()
  });
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  lockLinks(mainWin);
  // Ao fechar (X, Cmd+Q, Alt+F4) a tela do programa pergunta se quer mesmo sair.
  mainWin.on('close', (e) => {
    if (forceClose || !mainWin || mainWin.webContents.isCrashed()) return;
    e.preventDefault();
    sendToMain('app:close-request');
  });
  mainWin.on('closed', () => {
    mainWin = null;
    if (telaoWin && !telaoWin.isDestroyed()) telaoWin.close();
  });
}

// Abre o telão em tela cheia no segundo monitor. Com uma tela só, abre numa janela.
function openTelao() {
  if (!mainWin) return;
  if (telaoWin && !telaoWin.isDestroyed()) {
    telaoWin.focus();
    return;
  }
  const current = screen.getDisplayMatching(mainWin.getBounds());
  const other = screen.getAllDisplays().find((d) => d.id !== current.id);
  // Sempre em tela cheia: no segundo monitor, se houver; senão, em um espaço próprio na mesma tela.
  const area = (other || current).bounds;
  const placement = { x: area.x, y: area.y, width: area.width, height: area.height, fullscreen: true };
  telaoWin = new BrowserWindow({
    ...placement,
    title: 'Telão',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0B1013',
    autoHideMenuBar: true,
    webPreferences: webPrefs()
  });
  telaoWin.loadFile(path.join(__dirname, 'app', 'index.html'), { hash: 'telao' });
  lockLinks(telaoWin);
  telaoWin.on('closed', () => {
    telaoWin = null;
    sendToMain('telao:status', false);
  });
  sendToMain('telao:status', true);
}

function closeTelao() {
  if (telaoWin && !telaoWin.isDestroyed()) telaoWin.close();
}

const fromMain = (e) => mainWin && !mainWin.isDestroyed() && e.sender === mainWin.webContents;
const fromTelao = (e) => telaoWin && !telaoWin.isDestroyed() && e.sender === telaoWin.webContents;

ipcMain.on('state:push', (e, payload) => {
  if (!fromMain(e)) return;
  lastState = payload;
  net.setState(payload);
  if (telaoWin && !telaoWin.isDestroyed()) telaoWin.webContents.send('state:update', payload);
});
ipcMain.on('state:request', (e) => {
  if (!fromTelao(e)) return;
  if (lastState) telaoWin.webContents.send('state:update', lastState);
  sendToMain('state:request');
});
const netInfo = () => ({ running: net.running, port: net.port, pin: net.pin, ips: net.ips() });
ipcMain.handle('net:start', async (e) => {
  if (!fromMain(e)) return null;
  try { await net.start(7654); } catch (err) { return { error: String(err.code || err.message) }; }
  if (lastState) net.setState(lastState);
  return netInfo();
});
ipcMain.handle('net:stop', async (e) => { if (!fromMain(e)) return null; await net.stop(); return netInfo(); });
ipcMain.handle('net:info', (e) => (fromMain(e) ? netInfo() : null));
ipcMain.handle('net:pin', (e) => { if (!fromMain(e)) return null; net.regenPin(); return netInfo(); });
ipcMain.handle('net:qr', async (e, text) => {
  if (!fromMain(e) || !QR || typeof text !== 'string' || text.length > 600) return '';
  try { return await QR.toString(text, { type: 'svg', margin: 1, width: 220, color: { dark: '#000000', light: '#ffffff' } }); } catch (err) { return ''; }
});
app.on('quit', () => { net.stop(); });
const licDir = () => app.getPath('userData');
ipcMain.handle('lic:status', (e) => (fromMain(e) ? { ...license.status(licDir(), PUB), version: app.getVersion() } : null));
ipcMain.handle('lic:activate', (e, key) => {
  if (!fromMain(e) || typeof key !== 'string' || key.length > 2000) return { ok: false, error: 'formato' };
  const r = license.activate(licDir(), key, PUB);
  return r.ok ? { ok: true, status: { ...r.status, version: app.getVersion() } } : { ok: false, error: r.error };
});
// Aviso de versão nova: lê um version.json público (nada é instalado sozinho).
ipcMain.handle('app:update-check', async (e) => {
  if (!fromMain(e)) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://raw.githubusercontent.com/paulosoujava/BJJArena/main/version.json', { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const num = (v) => String(v).split('.').map((x) => parseInt(x, 10) || 0);
    const a = num(j.version), b = num(app.getVersion());
    let newer = false;
    for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) { newer = (a[i] || 0) > (b[i] || 0); break; } }
    return { newer, version: String(j.version), url: /^https:\/\//.test(j.url || '') ? j.url : 'https://github.com/paulosoujava/BJJArena', notas: String(j.notas || '').slice(0, 300) };
  } catch (err) { return null; }
});
ipcMain.on('app:open-external', (e, u) => { if (fromMain(e) && typeof u === 'string' && /^https:\/\//.test(u)) shell.openExternal(u); });
ipcMain.on('app:quit', (e) => { if (fromMain(e) && mainWin) mainWin.close(); });
ipcMain.on('app:close-confirm', (e) => {
  if (!fromMain(e)) return;
  forceClose = true;
  if (wantQuit) app.quit(); else if (mainWin) mainWin.close();
});
ipcMain.on('app:close-cancel', (e) => { if (fromMain(e)) wantQuit = false; });
app.on('before-quit', () => { wantQuit = true; });
ipcMain.on('telao:open', (e) => { if (fromMain(e)) openTelao(); });
ipcMain.on('telao:close', (e) => { if (fromMain(e) || fromTelao(e)) closeTelao(); });

const template = [
  { role: 'appMenu' },
  {
    label: 'Arquivo',
    submenu: [
      {
        label: 'Imprimir chaves…',
        accelerator: 'CmdOrCtrl+P',
        click: (_item, win) => {
          if (win) win.webContents.print({ landscape: true, printBackground: true });
        }
      },
      { type: 'separator' },
      { label: 'Abrir telão em outra tela', accelerator: 'CmdOrCtrl+T', click: () => openTelao() },
      { label: 'Fechar telão', click: () => closeTelao() },
      { type: 'separator' },
      { label: 'Histórico de campeonatos', accelerator: 'CmdOrCtrl+Shift+H', click: () => sendToMain('menu:history') },
      { type: 'separator' },
      { role: 'close' }
    ]
  },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' }
];

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(path.join(__dirname, 'build', 'icon.png')); } catch (e) {}
  }
  // Evita que a tela da TV ou do notebook apague durante o campeonato.
  powerSaveBlocker.start('prevent-display-sleep');
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
