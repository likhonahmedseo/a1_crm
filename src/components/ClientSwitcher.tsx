import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Users, Timer } from 'lucide-react';
import { useClients } from '../state/ClientContext';
import type { TimeEntry } from '../types';

export function ClientSwitcher() {
  const { clients, activeClient, setActiveClientId } = useClients();
  const [open, setOpen] = useState(false);
  const [trackerEntry, setTrackerEntry] = useState<TimeEntry | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Poll tracker status so we can show the running-client indicator
  const refreshTracker = useCallback(async () => {
    const s = await window.api.tracker.status();
    setTrackerEntry(s.status !== 'idle' && s.entry ? s.entry : null);
  }, []);

  useEffect(() => {
    refreshTracker();
    const offStatus = window.api.tracker.onStatusChange((s: any) => {
      setTrackerEntry(s.status !== 'idle' && s.entry ? s.entry : null);
    });
    return () => offStatus();
  }, [refreshTracker]);

  const trackerClientId = trackerEntry?.client_id ?? null;
  const trackerClientName = trackerEntry
    ? clients.find((c) => c.id === trackerClientId)?.name ?? null
    : null;

  // Is the tracker running for a client different from the current view?
  const trackerMismatch =
    trackerEntry && trackerClientId !== null && activeClient?.id !== trackerClientId;

  const handleSwitch = (clientId: number | null) => {
    setActiveClientId(clientId);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:border-slate-300 text-sm shadow-sm"
      >
        {activeClient ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeClient.color }} />
            <span className="font-medium">{activeClient.name}</span>
          </>
        ) : (
          <>
            <Users size={14} className="text-slate-500" />
            <span className="text-slate-600">All clients</span>
          </>
        )}

        {/* Tracker mismatch indicator */}
        {trackerMismatch && (
          <span
            className="flex items-center gap-0.5 ml-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"
            title={`Tracker running for: ${trackerClientName}`}
          >
            <Timer size={9} className="shrink-0" />
            {trackerClientName}
          </span>
        )}

        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
          {/* Tracker warning banner */}
          {trackerEntry && (
            <div className={`px-3 py-2 text-[11px] flex items-start gap-2 border-b border-slate-100 ${
              trackerEntry.status === 'running'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}>
              <Timer size={12} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  {trackerEntry.status === 'running' ? 'Tracker is running' : 'Tracker is paused'}
                </span>
                {trackerClientName && (
                  <span className="font-normal"> for <strong>{trackerClientName}</strong></span>
                )}
                <div className="opacity-70 mt-0.5">
                  Switching clients only changes your view — the active session keeps running.
                </div>
              </div>
            </div>
          )}

          {/* All clients option */}
          <div className="py-1 max-h-72 overflow-auto">
            <button
              onClick={() => handleSwitch(null)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-500" />
                <span>All clients</span>
              </div>
              {activeClient === null && <Check size={14} className="text-brand-500" />}
            </button>

            <div className="border-t border-slate-100 my-1" />

            {clients.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-500">
                No clients yet — add one in Clients.
              </div>
            )}

            {clients.map((c) => {
              const isActive = activeClient?.id === c.id;
              const isTracked = trackerClientId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSwitch(c.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                    isActive ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className={`truncate ${isActive ? 'font-medium text-brand-700' : ''}`}>
                      {c.name}
                    </span>
                    {c.company && (
                      <span className="text-xs text-slate-400 truncate">· {c.company}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isTracked && trackerEntry && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        trackerEntry.status === 'running'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        <Timer size={9} />
                        {trackerEntry.status === 'running' ? 'Running' : 'Paused'}
                      </span>
                    )}
                    {isActive && <Check size={14} className="text-brand-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Jump to tracker session */}
          {trackerMismatch && (
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                onClick={() => {
                  if (trackerClientId) handleSwitch(trackerClientId);
                }}
                className="w-full text-xs text-brand-600 hover:text-brand-700 text-center py-1"
              >
                Switch to <strong>{trackerClientName}</strong> to view the active session →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
