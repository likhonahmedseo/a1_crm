import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Play, Pause, Square, Camera, FolderOpen, ImageIcon,
  Clock, CalendarDays, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';
import { formatClock, formatDuration, formatDateTime } from '../lib/utils';
import type { Task, TimeEntry } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function entryTotal(e: TimeEntry, now: number): number {
  if (e.status === 'running' && e.segment_started_at) {
    return (e.accumulated_ms || 0) + (now - e.segment_started_at);
  }
  return e.accumulated_ms || e.duration_ms || 0;
}

function groupByDate(entries: TimeEntry[]): { date: string; entries: TimeEntry[] }[] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const d = e.date || 'Unknown';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, entries }));
}

function formatLocalDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown date';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Tracker() {
  const { clients, activeClientId, setActiveClientId } = useClients();
  const { toast } = useToast();

  const [trackerStatus, setTrackerStatus] = useState<'running' | 'paused' | 'idle'>('idle');
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(Date.now());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [description, setDescription] = useState('');
  const [taskId, setTaskId] = useState<number | ''>('');
  const [clientId, setClientId] = useState<number | ''>(activeClientId ?? '');
  const [viewingEntry, setViewingEntry] = useState<TimeEntry | null>(null);
  const [shots, setShots] = useState<any[]>([]);
  const [shotPreviews, setShotPreviews] = useState<Record<string, string>>({});
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // ── data load ───────────────────────────────────────────────────────────────

  const applyStatus = useCallback((s: any) => {
    setTrackerStatus(s.status);
    setActiveEntry(s.entry ?? null);
  }, []);

  const refreshStatus = useCallback(async () => {
    applyStatus(await window.api.tracker.status());
  }, [applyStatus]);

  const reloadEntries = useCallback(async () => {
    const list = await window.api.tracker.entries({ clientId: activeClientId });
    setEntries(list);
    // Auto-expand today
    const today = new Date().toISOString().slice(0, 10);
    setExpandedDates((prev) => new Set([...prev, today]));
  }, [activeClientId]);

  const reloadTasks = useCallback(async () => {
    const list = await window.api.tasks.list({ clientId: activeClientId });
    setTasks(list);
  }, [activeClientId]);

  useEffect(() => {
    refreshStatus();
    reloadEntries();
    reloadTasks();
  }, [refreshStatus, reloadEntries, reloadTasks]);

  useEffect(() => {
    if (activeClientId !== undefined) setClientId(activeClientId ?? '');
  }, [activeClientId]);

  useEffect(() => {
    if (taskId === '') return;
    const selectedTask = tasks.find((t) => t.id === Number(taskId));
    const selectedClientId = clientId === '' ? null : Number(clientId);
    if (!selectedTask || selectedTask.client_id !== selectedClientId) {
      setTaskId('');
    }
  }, [clientId, taskId, tasks]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // IPC events
  useEffect(() => {
    const offShot = window.api.tracker.onScreenshot(() => {
      reloadEntries();
      if (viewingEntry) loadShots(viewingEntry.id);
    });
    const offStatus = window.api.tracker.onStatusChange((s: any) => {
      applyStatus(s);
      reloadEntries();
    });
    return () => { offShot(); offStatus(); };
  }, [viewingEntry, reloadEntries, applyStatus]);

  // ── actions ─────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    const cId = clientId === '' ? null : Number(clientId);
    const r = await window.api.tracker.start({
      clientId: cId,
      taskId: taskId === '' ? null : Number(taskId),
      description,
    });
    if (!r.ok) { toast('error', 'Cannot start', r.error); return; }
    if ((r as any).resumed) toast('info', 'Session resumed', 'Continuing today\'s session.');
    window.api.app.refreshTray();
    await refreshStatus();
    await reloadEntries();
  };

  const handlePause = async () => {
    const r = await window.api.tracker.pause();
    if (!r.ok) { toast('error', 'Pause failed', r.error); return; }
    window.api.app.refreshTray();
    await refreshStatus();
  };

  const handleResume = async () => {
    const r = await window.api.tracker.resume();
    if (!r.ok) { toast('error', 'Resume failed', r.error); return; }
    window.api.app.refreshTray();
    await refreshStatus();
  };

  const handleStop = async () => {
    if (!confirm('Mark this session as done for today? You cannot resume it after.')) return;
    const r = await window.api.tracker.stop();
    if (!r.ok) { toast('error', 'Stop failed', r.error); return; }
    toast('success', 'Session completed', `Total: ${formatDuration(r.durationMs ?? 0)}`);
    window.api.app.refreshTray();
    setDescription('');
    setTaskId('');
    await refreshStatus();
    await reloadEntries();
  };

  const loadShots = async (entryId: number) => {
    const list = await window.api.tracker.screenshots(entryId);
    setShots(list);
    const previews: Record<string, string> = {};
    for (const s of list) {
      const dataUrl = await window.api.tracker.readScreenshot(s.file_path);
      if (dataUrl) previews[s.file_path] = dataUrl;
    }
    setShotPreviews(previews);
  };

  const openEntry = async (e: TimeEntry) => {
    setViewingEntry(e);
    await loadShots(e.id);
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  // ── derived ─────────────────────────────────────────────────────────────────

  const shouldShowActiveEntry = !!activeEntry && (
    trackerStatus === 'running' ||
    !activeClientId ||
    activeEntry.client_id === activeClientId
  );
  const visibleActiveEntry = shouldShowActiveEntry ? activeEntry : null;
  const elapsed = visibleActiveEntry ? entryTotal(visibleActiveEntry, now) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const todayEntries = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const historyEntries = useMemo(() => entries.filter((e) => e.date !== today), [entries, today]);
  const historyGroups = useMemo(() => groupByDate(historyEntries), [historyEntries]);

  const isActive = trackerStatus === 'running' || trackerStatus === 'paused';
  const showActivePanel = isActive && !!visibleActiveEntry;

  // Client name for active session
  const activeClientName = useMemo(() => {
    if (!activeEntry?.client_id) return null;
    return clients.find((c) => c.id === activeEntry.client_id)?.name ?? null;
  }, [activeEntry, clients]);

  // Cross-client mismatch: tracker is running for a client not currently viewed
  const crossClientMismatch = useMemo(() => {
    if (!isActive || !activeEntry?.client_id) return false;
    if (!activeClientId) return false; // "All clients" view — no mismatch
    return activeEntry.client_id !== activeClientId;
  }, [isActive, activeEntry, activeClientId]);

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Cross-client warning banner */}
      {crossClientMismatch && activeEntry && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">
              {trackerStatus === 'running' ? 'Tracker is running' : 'Tracker is paused'}
            </span>{' '}
            for <strong>{activeClientName}</strong> — but you are currently viewing a different client.
            The session is unaffected.
          </div>
          <button
            onClick={() => setActiveClientId(activeEntry.client_id)}
            className="shrink-0 text-xs font-medium text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100"
          >
            Switch to {activeClientName} →
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
            <CalendarDays size={13} /> {todayLabel()}
          </p>
        </div>
        <button
          onClick={() => window.api.tracker.openScreenshotsDir()}
          className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1.5"
        >
          <FolderOpen size={14} /> Screenshots folder
        </button>
      </div>

      {/* ── Active session panel ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        {showActivePanel ? (
          /* Running or Paused */
          <div className="flex flex-col items-center gap-5">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">
                {trackerStatus === 'running' ? 'Tracking' : 'Paused'}
                {activeClientName && <span className="ml-1.5 font-medium text-slate-600">· {activeClientName}</span>}
              </div>
              <div
                className={`font-mono text-6xl font-bold tabular-nums ${
                  trackerStatus === 'running' ? 'text-emerald-600' : 'text-amber-500'
                }`}
              >
                {formatClock(elapsed)}
              </div>
              {visibleActiveEntry?.description && (
                <div className="text-slate-500 text-sm mt-2">{visibleActiveEntry.description}</div>
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Camera size={12} />
              {trackerStatus === 'running'
                ? 'Random screenshots every 5–10 minutes'
                : 'Screenshots paused — resume to continue capturing'}
            </div>

            <div className="flex items-center gap-3">
              {trackerStatus === 'running' ? (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium"
                >
                  <Pause size={16} /> Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                >
                  <Play size={16} /> Resume
                </button>
              )}
              <button
                onClick={handleStop}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                <Square size={16} /> Done for today
              </button>
            </div>
          </div>
        ) : (
          /* Start form */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Client</div>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full input"
                >
                  <option value="">— None —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Task (optional)</div>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full input"
                >
                  <option value="">— None —</option>
                  {tasks
                    .filter((t) => t.status !== 'done')
                    .filter((t) => clientId === '' || t.client_id === Number(clientId))
                    .map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">What are you working on?</div>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work…"
                className="w-full input"
              />
            </label>

            {/* Show paused sessions for the selected client */}
            {clientId !== '' && (() => {
              const paused = todayEntries.find(
                (e) => e.client_id === Number(clientId) && e.status === 'paused'
              );
              return paused ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <Pause size={14} className="shrink-0" />
                  <span>
                    A paused session exists today ({formatDuration(paused.accumulated_ms)}).{' '}
                    Starting will <strong>resume</strong> it.
                  </span>
                </div>
              ) : null;
            })()}

            <button
              onClick={handleStart}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium"
            >
              <Play size={16} /> Start tracking
            </button>
          </div>
        )}
      </div>

      {/* ── Today's sessions ── */}
      {todayEntries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Clock size={15} /> Today's sessions
            </h2>
            <span className="text-xs text-slate-400">
              Total: {formatDuration(todayEntries.reduce((s, e) => s + entryTotal(e, now), 0))}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {todayEntries.map((e) => (
              <EntryRow key={e.id} entry={e} now={now} onClick={() => openEntry(e)} />
            ))}
          </div>
        </section>
      )}

      {/* ── History by date ── */}
      {historyGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-700">History</h2>
          {historyGroups.map(({ date, entries: dayEntries }) => {
            const expanded = expandedDates.has(date);
            const dayTotal = dayEntries.reduce((s, e) => s + entryTotal(e, now), 0);
            return (
              <div key={date} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-slate-50"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium text-sm text-slate-700 flex-1">
                    {formatLocalDate(date)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{formatDuration(dayTotal)}</span>
                  <span className="text-xs text-slate-400 ml-2">{dayEntries.length} session{dayEntries.length !== 1 ? 's' : ''}</span>
                </button>
                {expanded && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {dayEntries.map((e) => (
                      <EntryRow key={e.id} entry={e} now={now} onClick={() => openEntry(e)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {todayEntries.length === 0 && historyGroups.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-12">
          No time tracked yet. Start your first session above.
        </div>
      )}

      {/* ── Entry detail modal ── */}
      <Modal
        open={viewingEntry !== null}
        onClose={() => setViewingEntry(null)}
        title="Session details"
        width="max-w-3xl"
      >
        {viewingEntry && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Client" value={viewingEntry.client_name || '—'} />
              <Field label="Task" value={viewingEntry.task_title || '—'} />
              <Field label="Description" value={viewingEntry.description || '—'} />
              <Field label="Date" value={formatLocalDate(viewingEntry.date)} />
              <Field
                label="Total time"
                value={formatDuration(entryTotal(viewingEntry, now))}
              />
              <Field
                label="Status"
                value={viewingEntry.status === 'running' ? '🟢 Running' : viewingEntry.status === 'paused' ? '⏸ Paused' : '✓ Done'}
              />
              <Field label="Started" value={formatDateTime(viewingEntry.started_at)} />
              <Field label="Ended" value={viewingEntry.ended_at ? formatDateTime(viewingEntry.ended_at) : '—'} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon size={14} />
                <h3 className="font-semibold text-sm">Screenshots ({shots.length})</h3>
              </div>
              {shots.length === 0 ? (
                <div className="text-sm text-slate-500">No screenshots captured yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {shots.map((s) => (
                    <div key={s.id} className="bg-slate-100 rounded overflow-hidden">
                      {shotPreviews[s.file_path] ? (
                        <img src={shotPreviews[s.file_path]} alt="screenshot" className="w-full" />
                      ) : (
                        <div className="aspect-video flex items-center justify-center text-slate-400 text-xs">
                          loading…
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 px-2 py-1">{formatDateTime(s.taken_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EntryRow({
  entry, now, onClick,
}: { entry: TimeEntry; now: number; onClick: () => void }) {
  const total = entryTotal(entry, now);
  const statusColor =
    entry.status === 'running'
      ? 'bg-emerald-100 text-emerald-700'
      : entry.status === 'paused'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-500';
  const statusLabel =
    entry.status === 'running' ? 'Running' : entry.status === 'paused' ? 'Paused' : 'Done';

  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {entry.description || entry.task_title || entry.client_name || 'Untitled session'}
        </div>
        {entry.client_name && (
          <div className="text-xs text-slate-500 mt-0.5">{entry.client_name}</div>
        )}
      </div>
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
        {statusLabel}
      </span>
      <div className="font-mono text-sm text-slate-700 shrink-0">
        {formatDuration(total)}
      </div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}
