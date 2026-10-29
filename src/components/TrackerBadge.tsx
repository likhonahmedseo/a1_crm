import { useEffect, useState, useCallback } from 'react';
import { Pause, Play, Square, Circle } from 'lucide-react';
import { formatClock } from '../lib/utils';
import type { TimeEntry } from '../types';

function entryElapsed(entry: TimeEntry, now: number): number {
  if (entry.status === 'running' && entry.segment_started_at) {
    return (entry.accumulated_ms || 0) + (now - entry.segment_started_at);
  }
  return entry.accumulated_ms || 0;
}

export function TrackerBadge() {
  const [trackerStatus, setTrackerStatus] = useState<'running' | 'paused' | 'idle'>('idle');
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    const s = await window.api.tracker.status();
    setTrackerStatus(s.status as any);
    setEntry(s.entry ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Listen for real-time status changes
    const offStatus = window.api.tracker.onStatusChange((s: any) => {
      setTrackerStatus(s.status);
      setEntry(s.entry ?? null);
    });
    return () => {
      clearInterval(tick);
      offStatus();
    };
  }, [refresh]);

  if (trackerStatus === 'idle' || !entry) return null;

  const elapsed = entryElapsed(entry, now);
  const isRunning = trackerStatus === 'running';

  const handlePause = async () => { await window.api.tracker.pause(); };
  const handleResume = async () => { await window.api.tracker.resume(); };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm ${
      isRunning
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      {isRunning ? (
        <Circle size={10} className="fill-emerald-500 text-emerald-500 animate-pulse" />
      ) : (
        <Circle size={10} className="fill-amber-400 text-amber-400" />
      )}
      <span className="font-mono font-medium">{formatClock(elapsed)}</span>
      {entry.client_name && (
        <span className="text-xs opacity-70 max-w-24 truncate">{entry.client_name}</span>
      )}
      {isRunning ? (
        <button
          onClick={handlePause}
          className="ml-1 p-1 rounded hover:bg-emerald-100"
          title="Pause tracking"
        >
          <Pause size={12} />
        </button>
      ) : (
        <button
          onClick={handleResume}
          className="ml-1 p-1 rounded hover:bg-amber-100"
          title="Resume tracking"
        >
          <Play size={12} />
        </button>
      )}
    </div>
  );
}
