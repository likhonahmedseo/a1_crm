import { desktopCapturer, screen, app, BrowserWindow, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb, nextId, save } from './db';

// ─── State ────────────────────────────────────────────────────────────────────
let activeEntryId: number | null = null;          // currently running entry
let screenshotTimer: NodeJS.Timeout | null = null; // next screenshot
let midnightTimer: NodeJS.Timeout | null = null;   // auto-finalize at midnight

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(ts = Date.now()): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function screenshotsDir() {
  const dir = path.join(app.getPath('userData'), 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function randomDelayMs() {
  const min = 5 * 60 * 1000;
  const max = 10 * 60 * 1000;
  return Math.floor(min + Math.random() * (max - min));
}

function broadcast(channel: string, payload: unknown) {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, payload));
}

function broadcastStatus() {
  broadcast('tracker:statusChange', buildStatus());
}

function buildStatus() {
  if (activeEntryId === null) return { status: 'idle' };
  const db = getDb();
  const entry = db.time_entries.find((e: any) => e.id === activeEntryId);
  if (!entry) return { status: 'idle' };
  const client = entry.client_id
    ? db.clients.find((c: any) => c.id === entry.client_id)
    : null;
  const task = entry.task_id
    ? db.tasks.find((t: any) => t.id === entry.task_id)
    : null;
  return {
    status: entry.status as 'running' | 'paused',
    entry: { ...entry, client_name: client?.name ?? null, task_title: task?.title ?? null },
  };
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(entryId: number) {
  try {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });
    if (!sources.length) return;
    const png = sources[0].thumbnail.toPNG();
    const filename = `entry-${entryId}-${Date.now()}.png`;
    const filePath = path.join(screenshotsDir(), filename);
    fs.writeFileSync(filePath, png);

    const db = getDb();
    const shot = {
      id: nextId('screenshots'),
      time_entry_id: entryId,
      file_path: filePath,
      taken_at: Date.now(),
    };
    db.screenshots.push(shot);
    save();

    const entry = db.time_entries.find((e: any) => e.id === entryId);
    const client = entry?.client_id
      ? db.clients.find((c: any) => c.id === entry.client_id)
      : null;

    broadcast('tracker:screenshot', { ...shot, client_name: client?.name ?? null });

    if (Notification.isSupported()) {
      new Notification({
        title: 'A1 CRM — Screenshot captured',
        body: client ? `Tracking: ${client.name}` : 'Time tracker screenshot saved.',
        silent: true,
      }).show();
    }
  } catch (err) {
    console.error('Screenshot error:', err);
    broadcast('app:notify', {
      type: 'error',
      title: 'Screenshot failed',
      description: err instanceof Error ? err.message : String(err),
    });
  }
}

function scheduleNextScreenshot() {
  stopScreenshots();
  if (activeEntryId === null) return;
  screenshotTimer = setTimeout(async () => {
    if (activeEntryId === null) return;
    await captureScreenshot(activeEntryId);
    scheduleNextScreenshot();
  }, randomDelayMs());
}

function stopScreenshots() {
  if (screenshotTimer) {
    clearTimeout(screenshotTimer);
    screenshotTimer = null;
  }
}

// ─── Midnight auto-finalize ───────────────────────────────────────────────────

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function scheduleMidnightReset() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const ms = msUntilMidnight();
  midnightTimer = setTimeout(() => {
    // Finalize any active/paused session at midnight
    if (activeEntryId !== null) {
      finalizeEntry(activeEntryId);
      activeEntryId = null;
      stopScreenshots();
      broadcast('app:notify', {
        type: 'info',
        title: 'New day started',
        description: 'Time tracker session finalized at midnight.',
      });
      broadcastStatus();
    }
    // Re-arm for next midnight
    scheduleMidnightReset();
  }, ms);
}

function finalizeEntry(entryId: number) {
  const db = getDb();
  const entry = db.time_entries.find((e: any) => e.id === entryId);
  if (!entry) return;
  const now = Date.now();
  // Add current segment time if running
  if (entry.status === 'running' && entry.segment_started_at) {
    entry.accumulated_ms = (entry.accumulated_ms || 0) + (now - entry.segment_started_at);
  }
  entry.segment_started_at = null;
  entry.status = 'done';
  entry.ended_at = now;
  entry.duration_ms = entry.accumulated_ms || 0;
  save();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start or resume today's session for the given client.
 * Rules:
 *  - If another session is actively running → error
 *  - If today already has a paused session for this client → resume it
 *  - Otherwise → create a new session for today
 */
export function startTracking(opts: {
  clientId?: number | null;
  taskId?: number | null;
  description?: string;
}) {
  const db = getDb();
  const today = localDateStr();

  // Can't start if something else is already running
  if (activeEntryId !== null) {
    const active = db.time_entries.find((e: any) => e.id === activeEntryId);
    if (active?.status === 'running') {
      return { ok: false, error: 'A session is already running. Pause it first.' };
    }
  }

  const clientId = opts.clientId ?? null;

  // Look for an existing non-done session for this client today
  const existing = db.time_entries.find(
    (e: any) =>
      e.date === today &&
      e.client_id === clientId &&
      (e.status === 'paused' || e.status === 'running')
  );

  if (existing) {
    // Resume the paused session
    existing.status = 'running';
    existing.segment_started_at = Date.now();
    if (opts.description) existing.description = opts.description;
    save();
    activeEntryId = existing.id;
    scheduleNextScreenshot();
    scheduleMidnightReset();
    broadcastStatus();
    return { ok: true, entryId: existing.id, resumed: true };
  }

  // Create a brand-new daily session
  const entry = {
    id: nextId('time_entries'),
    client_id: clientId,
    task_id: opts.taskId ?? null,
    description: opts.description ?? null,
    date: today,
    status: 'running',
    segment_started_at: Date.now(),
    accumulated_ms: 0,
    started_at: Date.now(),
    ended_at: null as number | null,
    duration_ms: null as number | null,
  };
  db.time_entries.push(entry);
  save();
  activeEntryId = entry.id;
  scheduleNextScreenshot();
  scheduleMidnightReset();
  broadcastStatus();
  return { ok: true, entryId: entry.id, resumed: false };
}

/** Pause the running session (keeps it open for resume later today) */
export function pauseTracking() {
  if (activeEntryId === null) return { ok: false, error: 'No active session' };
  const db = getDb();
  const entry = db.time_entries.find((e: any) => e.id === activeEntryId);
  if (!entry) return { ok: false, error: 'Session not found' };
  if (entry.status !== 'running') return { ok: false, error: 'Session is not running' };

  const now = Date.now();
  entry.accumulated_ms = (entry.accumulated_ms || 0) + (now - entry.segment_started_at);
  entry.segment_started_at = null;
  entry.status = 'paused';
  save();

  stopScreenshots();
  broadcastStatus();
  return { ok: true, accumulated_ms: entry.accumulated_ms };
}

/** Resume a paused session */
export function resumeTracking() {
  if (activeEntryId === null) return { ok: false, error: 'No session to resume' };
  const db = getDb();
  const entry = db.time_entries.find((e: any) => e.id === activeEntryId);
  if (!entry) return { ok: false, error: 'Session not found' };
  if (entry.status !== 'paused') return { ok: false, error: 'Session is not paused' };

  entry.status = 'running';
  entry.segment_started_at = Date.now();
  save();

  scheduleNextScreenshot();
  scheduleMidnightReset();
  broadcastStatus();
  return { ok: true };
}

/** Fully finalize (end) the current session — marks it done for today */
export function stopTracking() {
  if (activeEntryId === null) return { ok: false, error: 'No active session' };
  const entryId = activeEntryId;
  finalizeEntry(entryId);
  activeEntryId = null;
  stopScreenshots();

  const db = getDb();
  const entry = db.time_entries.find((e: any) => e.id === entryId);
  broadcastStatus();
  return { ok: true, entryId, durationMs: entry?.duration_ms ?? 0 };
}

export function getTrackerStatus() {
  return buildStatus();
}

/** Return today's session for a given client (running or paused), or null */
export function getTodaySession(clientId: number | null) {
  const db = getDb();
  const today = localDateStr();
  return (
    db.time_entries.find(
      (e: any) =>
        e.date === today &&
        e.client_id === clientId &&
        (e.status === 'running' || e.status === 'paused')
    ) ?? null
  );
}
