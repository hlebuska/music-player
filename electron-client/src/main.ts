import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerMicPermissionHandlers } from './micPermission';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
};

// Visible for testing; will be hidden and driven by the server's commands
const createPlayerWindow = () => {
  const playerWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    // persist: keeps the Google sign-in across restarts
    webPreferences: { partition: 'persist:ytmusic' },
  });

  // Google blocks sign-in when the user agent mentions Electron
  const chromeUserAgent = app.userAgentFallback
    .replace(/ Electron\/\S+/, '')
    .replace(` ${app.getName()}/${app.getVersion()}`, '');
  playerWindow.webContents.setUserAgent(chromeUserAgent);

  playerWindow.loadURL('https://music.youtube.com');
};

app.whenReady().then(() => {
  registerMicPermissionHandlers();
  createWindow();
  createPlayerWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
