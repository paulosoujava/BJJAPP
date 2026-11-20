const { app, BrowserWindow, Menu, shell, nativeTheme, powerSaveBlocker, ipcMain, screen } = require('electron');
const path = require('path');

// Mantém os dados salvos das versões anteriores (antes o app se chamava Chaveador Jiu-Jitsu).
app.setPath('userData', path.join(app.getPath('appData'), 'Chaveador Jiu-Jitsu'));

let mainWin = null;
let telaoWin = null;
let lastState = null;

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
  mainWin = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'BJJ Arena',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1316' : '#ECEFF1',
    webPreferences: webPrefs()
  });
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  lockLinks(mainWin);
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
  if (telaoWin && !telaoWin.isDestroyed()) telaoWin.webContents.send('state:update', payload);
});
ipcMain.on('state:request', (e) => {
  if (!fromTelao(e)) return;
  if (lastState) telaoWin.webContents.send('state:update', lastState);
  sendToMain('state:request');
});
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
