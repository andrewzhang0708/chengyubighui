const { app, BrowserWindow, Menu, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

const smokeTest = process.argv.includes('--smoke-test');
const reportPath = process.env.CHENGYU_SMOKE_REPORT;
let mainWindow;
let reported = false;
let timeout;

protocol.registerSchemesAsPrivileged([
  { scheme: 'chengyu', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function report(ok, detail) {
  if (!smokeTest || reported) return;
  reported = true;
  clearTimeout(timeout);
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ ok, detail, packaged: app.isPackaged, version: app.getVersion() }, null, 2));
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(async () => {
  app.setAppUserModelId('local.chengyu.dahui');
  Menu.setApplicationMenu(null);
  const rendererRoot = path.join(app.getAppPath(), 'renderer');
  protocol.handle('chengyu', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    const file = path.resolve(rendererRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(rendererRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(permission === 'fullscreen' && contents.getURL().startsWith('chengyu://app/'));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => permission === 'fullscreen' && origin === 'chengyu://app');
  // This offline app never needs to fetch external content.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));

  mainWindow = new BrowserWindow({
    title: '成语大会', width: 1200, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#f7f4ed', show: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  });
  mainWindow.webContents.on('render-process-gone', (_event, detail) => report(false, detail));
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    if (smokeTest) report(false, { code, description });
    else dialog.showErrorBox('无法打开成语大会', description);
  });
  if (smokeTest) {
    timeout = setTimeout(() => report(false, 'Application load timed out'), 20000);
    mainWindow.webContents.on('console-message', (_event, details) => {
      if (details.level === 'error') report(false, details.message);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => report(mainWindow.getTitle() === '成语大会', { title: mainWindow.getTitle(), url: mainWindow.webContents.getURL() }), 1500);
    });
  } else {
    mainWindow.once('ready-to-show', () => mainWindow.show());
  }
  await mainWindow.loadURL('chengyu://app/');
}).catch(error => {
  if (smokeTest) report(false, error.message);
  else { dialog.showErrorBox('成语大会启动失败', error.message); app.exit(1); }
});

app.on('window-all-closed', () => app.quit());
