import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Play, CheckCircle2, Circle, Clock,
  RefreshCw, AlertTriangle, CheckSquare, Square, Layers,
} from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/utils';
import type { Task } from '../types';

const STATUSES: { id: Task['status']; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

const PRIORITIES: { id: Task['priority']; label: string; color: string }[] = [
  { id: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600' },
  { id: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { id: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

function isOverdue(t: Task) {
  return t.status !== 'done' && t.due_date !== null && t.due_date < Date.now();
}
function isDueToday(t: Task) {
  if (t.status === 'done' || !t.due_date) return false;
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  return t.due_date >= s.getTime() && t.due_date <= e.getTime();
}

export default function Tasks() {
  const { clients, activeClientId } = useClients();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [filter, setFilter] = useState<'all' | Task['status']>('all');

  // Bulk selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkAssignClientId, setBulkAssignClientId] = useState<number | ''>('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const reload = useCallback(async () => {
    const list = await window.api.tasks.list({
      clientId: activeClientId,
      status: filter === 'all' ? undefined : filter,
    });
    setTasks(list);
    setSelected(new Set());
  }, [activeClientId, filter]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!editing || !editing.title) return;
    if (editing.id) {
      await window.api.tasks.update(editing.id, editing);
    } else {
      await window.api.tasks.create({ ...editing, client_id: editing.client_id ?? activeClientId ?? null });
    }
    setEditing(null);
    await reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await window.api.tasks.delete(id);
    await reload();
  };

  const toggleStatus = async (t: Task) => {
    const next: Task['status'] =
      t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
    await window.api.tasks.update(t.id, { ...t, status: next });
    if (next === 'done' && t.recurring && t.recurring !== 'none') {
      toast('info', 'Recurring task scheduled', `Next ${t.recurring} occurrence created automatically.`);
    }
    await reload();
  };

  const startTracking = async (t: Task) => {
    const r = await window.api.tracker.start({ clientId: t.client_id, taskId: t.id, description: t.title });
    if (r.ok) toast('success', 'Tracker started', t.title);
    else toast('error', 'Could not start tracker', r.error);
  };

  // ── Bulk helpers ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  };

  const bulkMarkDone = async () => {
    if (!selected.size) return;
    await Promise.all(
      tasks.filter((t) => selected.has(t.id) && t.status !== 'done')
        .map((t) => window.api.tasks.update(t.id, { ...t, status: 'done' }))
    );
    toast('success', `${selected.size} task${selected.size > 1 ? 's' : ''} marked done`);
    await reload();
  };

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} task${selected.size > 1 ? 's' : ''}?`)) return;
    await Promise.all([...selected].map((id) => window.api.tasks.delete(id)));
    toast('success', `${selected.size} task${selected.size > 1 ? 's' : ''} deleted`);
    await reload();
  };

  const bulkAssign = async () => {
    if (!selected.size || !bulkAssignClientId) return;
    await Promise.all(
      tasks.filter((t) => selected.has(t.id))
        .map((t) => window.api.tasks.update(t.id, { ...t, client_id: Number(bulkAssignClientId) }))
    );
    toast('success', `${selected.size} task${selected.size > 1 ? 's' : ''} assigned`);
    setShowBulkAssign(false);
    setBulkAssignClientId('');
    await reload();
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            {activeClientId ? 'Filtered to active client' : 'Across all clients'}
            {overdueCount > 0 && (
              <span className="text-red-500 font-medium flex items-center gap-1">
                <AlertTriangle size={12} /> {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBulkMode((v) => !v); setSelected(new Set()); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              bulkMode ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle bulk selection mode"
          >
            <Layers size={14} /> Bulk
          </button>
          <button
            onClick={() => setEditing({ status: 'todo', priority: 'medium', recurring: 'none' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            <Plus size={14} /> New task
          </button>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {bulkMode && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-xl">
          <button onClick={toggleAll} className="flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900">
            {selected.size === tasks.length && tasks.length > 0
              ? <CheckSquare size={16} />
              : <Square size={16} />}
            {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
          </button>
          {selected.size > 0 && (
            <>
              <div className="w-px h-4 bg-brand-200" />
              <button
                onClick={bulkMarkDone}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                <CheckCircle2 size={14} /> Mark done
              </button>
              <button
                onClick={() => setShowBulkAssign(true)}
                className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 font-medium"
              >
                <RefreshCw size={14} /> Assign client
              </button>
              <button
                onClick={bulkDelete}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              filter === s ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? 'All' : STATUSES.find((x) => x.id === s)?.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {tasks.length === 0 && (
          <div className="text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
            No tasks yet.
          </div>
        )}
        {tasks.map((t) => {
          const pri = PRIORITIES.find((p) => p.id === t.priority)!;
          const overdue = isOverdue(t);
          const dueToday = isDueToday(t);
          const isSelected = selected.has(t.id);
          return (
            <div
              key={t.id}
              className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-colors ${
                isSelected ? 'border-brand-400 bg-brand-50/30' :
                overdue ? 'border-red-200 bg-red-50/40' :
                dueToday ? 'border-amber-200' : 'border-slate-200'
              }`}
            >
              {/* Bulk checkbox */}
              {bulkMode && (
                <button onClick={() => toggleSelect(t.id)} className="shrink-0 text-slate-400 hover:text-brand-500">
                  {isSelected ? <CheckSquare size={18} className="text-brand-500" /> : <Square size={18} />}
                </button>
              )}

              <button onClick={() => toggleStatus(t)} className="text-slate-400 hover:text-brand-500 shrink-0">
                {t.status === 'done' ? <CheckCircle2 size={20} className="text-emerald-500" /> :
                  t.status === 'in_progress' ? <Clock size={20} className="text-amber-500" /> :
                  <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                  {t.title}
                  {t.recurring && t.recurring !== 'none' && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-brand-400">
                      <RefreshCw size={9} /> {t.recurring}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                  {t.client_name && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: t.client_color || '#94a3b8' }} />
                      {t.client_name}
                    </span>
                  )}
                  {t.due_date && (
                    <span className={overdue ? 'text-red-500 font-medium' : dueToday ? 'text-amber-600 font-medium' : ''}>
                      {overdue ? '⚠ Overdue · ' : dueToday ? '📅 Due today · ' : 'Due '}
                      {formatDate(t.due_date)}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${pri.color}`}>{pri.label}</span>
                </div>
              </div>
              <button onClick={() => startTracking(t)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 shrink-0" title="Start tracking">
                <Play size={14} />
              </button>
              <button onClick={() => setEditing(t)} className="p-2 rounded-lg hover:bg-slate-100 shrink-0">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bulk assign client modal */}
      <Modal open={showBulkAssign} onClose={() => setShowBulkAssign(false)} title={`Assign ${selected.size} task${selected.size > 1 ? 's' : ''} to client`}>
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-medium text-slate-600 mb-1">Client</div>
            <select
              value={bulkAssignClientId}
              onChange={(e) => setBulkAssignClientId(e.target.value ? Number(e.target.value) : '')}
              className="w-full input"
            >
              <option value="">— Select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowBulkAssign(false)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100">Cancel</button>
            <button onClick={bulkAssign} disabled={!bulkAssignClientId} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
              Assign
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Task' : 'New Task'}>
        {editing && (
          <div className="space-y-3">
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Title *</div>
              <input autoFocus value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full input" />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Description</div>
              <textarea rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Client</div>
                <select value={editing.client_id ?? ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value ? Number(e.target.value) : null })} className="w-full input">
                  <option value="">— None —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Due date</div>
                <input type="date" value={editing.due_date ? new Date(editing.due_date).toISOString().slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value ? new Date(e.target.value).getTime() : null })} className="w-full input" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Status</div>
                <select value={editing.status ?? 'todo'} onChange={(e) => setEditing({ ...editing, status: e.target.value as Task['status'] })} className="w-full input">
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Priority</div>
                <select value={editing.priority ?? 'medium'} onChange={(e) => setEditing({ ...editing, priority: e.target.value as Task['priority'] })} className="w-full input">
                  {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">
                  <RefreshCw size={10} className="inline mr-1" />Recurring
                </div>
                <select value={editing.recurring ?? 'none'} onChange={(e) => setEditing({ ...editing, recurring: e.target.value as Task['recurring'] })} className="w-full input">
                  <option value="none">None</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
