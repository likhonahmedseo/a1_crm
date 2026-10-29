import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import { initDb, getDb, flushDb } from './db';
import { registerIpc } from './ipc';
import { initTray, refreshTray, destroyTray } from './tray';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false; // set true before intentional app.quit() calls

function shouldRunInBackground(): boolean {
  try {
    return getDb().settings['app.runInBackground'] === 'true';
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'A1 CRM',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  Menu.setApplicationMenu(null);

  // ── Intercept window close ────────────────────────────────────────────────
  mainWindow.on('close', (e) => {
    if (isQuitting) return; // real quit — let it close

    if (shouldRunInBackground()) {
      e.preventDefault();
      mainWindow?.hide();
      // First time: notify user
      if (!getDb().settings['app.trayNotified']) {
        getDb().settings['app.trayNotified'] = 'true';
        // We can't show a toast from main process here, but the tray tooltip
        // is visible. If Notification is supported, show one.
        try {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'A1 CRM is still running',
              body: 'The app is minimized to the system tray. Right-click the tray icon to quit.',
              silent: true,
            }).show();
          }
        } catch {}
      }
    }
  });
}

app.whenReady().then(() => {
  initDb();
  registerIpc();
  createWindow();

  if (mainWindow) {
    initTray(mainWindow);

    // Refresh tray whenever tracker status changes
    mainWindow.webContents.on('did-finish-load', () => {
      // Periodic tray refresh (every 30s) so icon tracks running/paused state
      setInterval(() => {
        if (mainWindow) refreshTray(mainWindow);
      }, 30_000);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

// Listen for tracker status changes from tracker.ts via IPC
// (tracker.ts already broadcasts 'tracker:statusChange' — we listen here too)
app.on('browser-window-created', (_, win) => {
  win.webContents.on('ipc-message', (_, channel) => {
    if (channel === 'tracker:statusChange' && mainWindow) {
      refreshTray(mainWindow);
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  try { flushDb(); } catch {}
  destroyTray();
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even with no windows (standard macOS behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/** Export for use in tray.ts "Quit" handler */
export function setQuitting() {
  isQuitting = true;
}
