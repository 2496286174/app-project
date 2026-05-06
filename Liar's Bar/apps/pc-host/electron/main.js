const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createHostRuntime } = require('@liars-bar/host-runtime');

const runtime = createHostRuntime({
  platform: 'pc',
  hostName: "Liar's Bar PC Host",
  port: Number(process.env.HOST_PORT || 3000),
  webRoot: path.join(__dirname, '..', 'build')
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  runtime.ready
    .then(() => mainWindow.loadURL(`http://localhost:${runtime.port}`))
    .catch((error) => {
      console.error('Failed to start host runtime:', error);
      app.quit();
    });
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  runtime.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  runtime.close();
});
