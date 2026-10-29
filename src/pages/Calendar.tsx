import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Facebook, Instagram, Youtube, Linkedin, Globe } from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';
import type { ContentItem } from '../types';

const PLATFORM_META: Record<string, { label: string; color: string; Icon: any }> = {
  facebook:  { label: 'Facebook',  color: '#1877f2', Icon: Facebook },
  instagram: { label: 'Instagram', color: '#e1306c', Icon: Instagram },
  youtube:   { label: 'YouTube',   color: '#ff0000', Icon: Youtube },
  linkedin:  { label: 'LinkedIn',  color: '#0a66c2', Icon: Linkedin },
};

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Calendar() {
  const { clients, activeClientId } = useClients();
  const { toast } = useToast();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<ContentItem[]>([]);
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null);
  const [detail, setDetail] = useState<ContentItem | null>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const reload = useCallback(async () => {
    const list = await window.api.content.list({ clientId: activeClientId, month: monthStr });
    setItems(list);
  }, [activeClientId, monthStr]);

  useEffect(() => { reload(); }, [reload]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const openNew = (date: string) => setEditing({
    scheduled_date: date,
    status: 'draft',
    platform: 'instagram',
    type: 'social_post',
    client_id: activeClientId ?? null,
    content: '',
  });

  const save = async () => {
    if (!editing?.content?.trim() || !editing.scheduled_date) return;
    if (editing.id) await window.api.content.update(editing.id, editing);
    else await window.api.content.create(editing);
    setEditing(null);
    toast('success', editing?.id ? 'Post updated' : 'Post scheduled');
    await reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this content item?')) return;
    await window.api.content.delete(id);
    setDetail(null);
    await reload();
    toast('success', 'Deleted');
  };

  const updateStatus = async (item: ContentItem, status: ContentItem['status']) => {
    await window.api.content.update(item.id, { ...item, status });
    await reload();
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: { date: string | null }[] = [
    ...Array(firstDay).fill({ date: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ date: toYMD(year, month, i + 1) })),
  ];
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const byDate = new Map<string, ContentItem[]>();
  items.forEach((item) => {
    if (!byDate.has(item.scheduled_date)) byDate.set(item.scheduled_date, []);
    byDate.get(item.scheduled_date)!.push(item);
  });

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm text-slate-500">Schedule and track social media content across clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></button>
          <span className="font-semibold text-lg min-w-44 text-center">{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {Object.entries(PLATFORM_META).map(([key, m]) => (
          <span key={key} className="flex items-center gap-1">
            <m.Icon size={12} style={{ color: m.color }} /> {m.label}
          </span>
        ))}
        <span className="ml-4 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Draft</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Scheduled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Published</span>
      </div>

      {/* Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell.date) return <div key={i} className="min-h-24 bg-slate-50/50 border-b border-r border-slate-100" />;
            const dayItems = byDate.get(cell.date) || [];
            const isToday = cell.date === todayYMD;
            return (
              <div
                key={cell.date}
                className={`min-h-24 border-b border-r border-slate-100 p-1.5 flex flex-col gap-1 ${isToday ? 'bg-brand-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-500 text-white' : 'text-slate-500'}`}>
                    {parseInt(cell.date.split('-')[2])}
                  </span>
                  <button
                    onClick={() => openNew(cell.date!)}
                    className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-0.5 rounded hover:bg-brand-100 text-brand-500 transition-opacity"
                    title="Add post"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {dayItems.slice(0, 3).map((item) => {
                  const meta = item.platform ? PLATFORM_META[item.platform] : null;
                  const Icon = meta?.Icon ?? Globe;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setDetail(item)}
                      className={`w-full text-left text-[10px] rounded px-1.5 py-1 flex items-center gap-1 truncate font-medium ${STATUS_COLORS[item.status]}`}
                    >
                      <Icon size={9} style={{ color: meta?.color, flexShrink: 0 }} />
                      <span className="truncate">{item.content.slice(0, 40)}</span>
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-slate-400 pl-1">+{dayItems.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit post modal */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit post' : 'Schedule post'} width="max-w-xl">
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Client</div>
                <select value={editing.client_id ?? ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value ? Number(e.target.value) : null })} className="w-full input">
                  <option value="">— None —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Platform</div>
                <select value={editing.platform ?? ''} onChange={(e) => setEditing({ ...editing, platform: e.target.value || null })} className="w-full input">
                  <option value="">— Any —</option>
                  {Object.entries(PLATFORM_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Scheduled date</div>
                <input type="date" value={editing.scheduled_date ?? ''} onChange={(e) => setEditing({ ...editing, scheduled_date: e.target.value })} className="w-full input" />
              </label>
              <label className="block">
                <div className="text-xs font-medium text-slate-600 mb-1">Status</div>
                <select value={editing.status ?? 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as ContentItem['status'] })} className="w-full input">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Content *</div>
              <textarea rows={5} value={editing.content ?? ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full input" placeholder="Post content…" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">Save</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal open={detail !== null} onClose={() => setDetail(null)} title="Post detail" width="max-w-xl">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-slate-400">Client</div>{detail.client_name || '—'}</div>
              <div><div className="text-xs text-slate-400">Platform</div>{detail.platform ? PLATFORM_META[detail.platform]?.label ?? detail.platform : '—'}</div>
              <div><div className="text-xs text-slate-400">Date</div>{detail.scheduled_date}</div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Status</div>
                <div className="flex gap-1">
                  {(['draft','scheduled','published'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { updateStatus(detail, s); setDetail({ ...detail, status: s }); }}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${detail.status === s ? STATUS_COLORS[s] : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{detail.content}</div>
            <div className="flex justify-between">
              <button onClick={() => remove(detail.id)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 size={14} /> Delete
              </button>
              <button onClick={() => { setDetail(null); setEditing(detail); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600">
                <Pencil size={14} /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
