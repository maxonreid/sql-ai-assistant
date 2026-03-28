const { app, BrowserWindow, ipcMain, session, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

let mainWindow;
let backendProcess;

// Retrieve the AES-256 encryption key from OS-protected storage (Windows DPAPI).
// On first run, a random key is generated, encrypted via safeStorage, and written
// to the app's userData directory. On subsequent runs it is decrypted and returned.
// The key is never stored in plaintext on disk.
function getOrCreateEncryptionKey() {
  const keyFile = path.join(app.getPath('userData'), 'encryption.key');

  if (fs.existsSync(keyFile)) {
    const encrypted = fs.readFileSync(keyFile);
    return safeStorage.decryptString(encrypted);
  }

  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFile, safeStorage.encryptString(key));
  return key;
}

// Start the backend API as a child process so Electron and API boot together.
function startBackend(encryptionKey) {
  const isDev   = process.env.NODE_ENV === 'development';
  const runner  = isDev ? 'tsx' : 'node';
  const entry   = isDev
    ? path.join(__dirname, '../backend/server.ts')
    : path.join(__dirname, '../backend/dist/server.js');

  backendProcess = spawn(runner, [entry], {
    env:   { ...process.env, ENCRYPTION_KEY: encryptionKey },
    stdio: 'inherit',
  });

  backendProcess.on('error', err => console.error('Backend failed to start:', err));
}

// Poll the health endpoint until the backend is ready or timeout is reached.
async function waitForBackend(port = 3001, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/api/health`);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Backend did not start in time');
}

async function createWindow() {
  // Set a restrictive CSP for all responses loaded by this session.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        ],
      },
    });
  });

  // Create the main renderer window with hardened web preferences.
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  });

  // In development load Next.js dev server, otherwise load exported static app.
  const isDev = process.env.NODE_ENV === 'development';
  await mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../frontend/out/index.html')}`
  );
}

// IPC handlers — must be registered before any renderer window is created.
ipcMain.handle('get-version', () => app.getVersion());

// App bootstrap sequence: start backend, wait for readiness, then open UI.
app.whenReady().then(async () => {
  const encryptionKey = getOrCreateEncryptionKey();
  startBackend(encryptionKey);
  await waitForBackend();
  await createWindow();
  // Check for updates once app is fully initialized.
  autoUpdater.checkForUpdatesAndNotify();
});

// Quit app on non-macOS platforms when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Ensure the child backend process is terminated when Electron exits.
app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});