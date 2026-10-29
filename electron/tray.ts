import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import { getTrackerStatus } from './tracker';
import { getDb } from './db';

let tray: Tray | null = null;

// ─── Icon generator ───────────────────────────────────────────────────────────
// Draws a 16x16 filled circle in brand blue (#3b6ef5) — no external file needed.

function makeTrayIcon(): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4); // RGBA raw pixels
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const r = 6.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const i = (y * size + x) * 4;
      if (dist <= r) {
        buf[i]     = 59;   // R — brand-500 #3b6ef5
        buf[i + 1] = 110;  // G
        buf[i + 2] = 245;  // B
        buf[i + 3] = 255;  // A opaque
      } else {
        buf[i + 3] = 0;    // transparent outside circle
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function makeTrackerIcon(status: 'running' | 'paused' | 'idle'): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const r = 6.5;

  // Color: running = emerald, paused = amber, idle = brand blue
  const [R, G, B] =
    status === 'running' ? [16, 185, 129]   // emerald-500
    : status === 'paused' ? [245, 158, 11]  // amber-500
    : [59, 110, 245];                        // brand-500

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const i = (y * size + x) * 4;
      if (dist <= r) {
        buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = 255;
      } else {
        buf[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initTray(win: BrowserWindow) {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('A1 CRM');

  // Single click on Windows shows the app
  tray.on('click', () => showWindow(win));
  tray.on('double-click', () => showWindow(win));

  refreshTray(win);
}

/** Call this whenever tracker status changes to update tray icon + menu */
export function refreshTray(win: BrowserWindow) {
  if (!tray) return;

  const s = getTrackerStatus() as any;
  const trackerStatus: 'running' | 'paused' | 'idle' =
    s.status === 'running' ? 'running' :
    s.status === 'paused'  ? 'paused'  : 'idle';

  // Update icon colour based on tracker state
  tray.setImage(makeTrackerIcon(trackerStatus));

  const clientName = s.entry?.client_name as string | null | undefined;
  const trackerLine =
    trackerStatus === 'running' ? `⏱  Tracking${clientName ? ': ' + clientName : ''}` :
    trackerStatus === 'paused'  ? `⏸  Paused${clientName ? ' — ' + clientName : ''}` :
    '⏹  Tracker idle';

  tray.setToolTip(`A1 CRM  •  ${trackerLine}`);

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'A1 CRM', enabled: false },
    { label: trackerLine, enabled: false },
    { type: 'separator' },
  ];

  // Tracker quick controls
  if (trackerStatus === 'running') {
    template.push({
      label: 'Pause tracker',
      click: async () => {
        const { pauseTracking } = await import('./tracker');
        pauseTracking();
        refreshTray(win);
      },
    });
  } else if (trackerStatus === 'paused') {
    template.push({
      label: 'Resume tracker',
      click: async () => {
        const { resumeTracking } = await import('./tracker');
        resumeTracking();
        refreshTray(win);
      },
    });
    template.push({
      label: 'Stop & finalize',
      click: async () => {
        const { stopTracking } = await import('./tracker');
        stopTracking();
        refreshTray(win);
      },
    });
  }

  template.push({ type: 'separator' });
  template.push({ label: 'Show A1 CRM', click: () => showWindow(win) });
  template.push({ type: 'separator' });
  template.push({
    label: 'Quit',
    click: () => {
      // Flush DB then quit — bypass the "hide to tray" close handler
      try { require('./db').flushDb(); } catch {}
      app.exit(0);
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

export function destroyTray() {
  tray?.destroy();
  tray = null;
}

function showWindow(win: BrowserWindow) {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
