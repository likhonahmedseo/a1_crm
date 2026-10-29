import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ExternalLink, Facebook, Instagram, Youtube, Linkedin,
  FileDown, MessageSquare, Send, ChevronDown, Globe, KeyRound, Eye, EyeOff,
  Copy, Check, Sparkles, Save, FileText, CheckSquare, Square, Target, RefreshCw,
} from 'lucide-react';
import type { ChecklistItem } from '../types';

const NOTE_TEMPLATES = [
  { label: 'Monthly review', body: 'Monthly review call:\n- KPIs reviewed:\n- Action items:\n- Next meeting:' },
  { label: 'Onboarding', body: 'Client onboarding completed:\n- Goals discussed:\n- Tools set up:\n- First deliverables:' },
  { label: 'Call summary', body: 'Call summary:\n- Topics covered:\n- Decisions made:\n- Follow-ups:' },
  { label: 'Content approval', body: 'Content submitted for approval:\n- Platform:\n- Content type:\n- Notes:' },
  { label: 'Issue logged', body: 'Issue reported:\n- Description:\n- Impact:\n- Resolution:' },
];
import { useClients } from '../state/ClientContext';
import { Modal } from '../components/Modal';
import { useToast } from '../state/ToastContext';
import { PLATFORMS, platformMeta, formatDateTime } from '../lib/utils';
import type { Client, SocialAccount, Note, WebsiteLogin } from '../types';

const platformIcon = (id: string) => {
  switch (id) {
    case 'facebook': return Facebook;
    case 'instagram': return Instagram;
    case 'youtube': return Youtube;
    case 'linkedin': return Linkedin;
    case 'website': return Globe;
    default: return ExternalLink;
  }
};

const STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
] as const;

export default function Clients() {
  const { clients, refresh, activeClientId, setActiveClientId } = useClients();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [logins, setLogins] = useState<WebsiteLogin[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [editingSocial, setEditingSocial] = useState<Partial<SocialAccount> | null>(null);
  const [editingLogin, setEditingLogin] = useState<Partial<WebsiteLogin> | null>(null);
  const [newNote, setNewNote] = useState('');

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (clients.length && selectedId === null) setSelectedId(activeClientId ?? clients[0].id);
  }, [clients, selectedId, activeClientId]);

  const loadDetail = useCallback(async () => {
    if (!selected) {
      setAccounts([]);
      setLogins([]);
      setNotes([]);
      return;
    }
    const [accs, wls, nts, ckls] = await Promise.all([
      window.api.social.listForClient(selected.id),
      window.api.websiteLogins.listForClient(selected.id),
      window.api.notes.listForClient(selected.id),
      window.api.checklists.listForClient(selected.id),
    ]);
    setAccounts(accs);
    setLogins(wls);
    setNotes(nts);
    setChecklists(ckls);
  }, [selected]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const saveClient = async () => {
    if (!editingClient || !editingClient.name) return;
    if (editingClient.id) {
      await window.api.clients.update(editingClient.id, editingClient);
    } else {
      const r = await window.api.clients.create(editingClient);
      setSelectedId(r.id);
    }
    setEditingClient(null);
    await refresh();
  };

  const deleteClient = async (id: number) => {
    if (!confirm('Delete this client and all its data?')) return;
    await window.api.clients.delete(id);
    if (activeClientId === id) setActiveClientId(null);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  };

  const saveSocial = async () => {
    if (!editingSocial || !selected || !editingSocial.platform) return;
    if (editingSocial.id) {
      await window.api.social.update(editingSocial.id, editingSocial);
    } else {
      await window.api.social.create({ ...editingSocial, client_id: selected.id });
    }
    setEditingSocial(null);
    await loadDetail();
  };

  const deleteSocial = async (id: number) => {
    if (!confirm('Remove this social account?')) return;
    await window.api.social.delete(id);
    await loadDetail();
  };

  const saveLogin = async () => {
    if (!editingLogin || !selected || !editingLogin.label) return;
    if (editingLogin.id) {
      await window.api.websiteLogins.update(editingLogin.id, editingLogin);
    } else {
      await window.api.websiteLogins.create({ ...editingLogin, client_id: selected.id });
    }
    setEditingLogin(null);
    await loadDetail();
  };

  const deleteLogin = async (id: number) => {
    if (!confirm('Remove this login?')) return;
    await window.api.websiteLogins.delete(id);
    await loadDetail();
  };

  const addCheckItem = async () => {
    if (!selected || !newCheckItem.trim()) return;
    await window.api.checklists.create({ client_id: selected.id, title: newCheckItem.trim() });
    setNewCheckItem('');
    await loadDetail();
  };

  const toggleCheckItem = async (id: number) => {
    await window.api.checklists.toggle(id);
    await loadDetail();
  };

  const deleteCheckItem = async (id: number) => {
    await window.api.checklists.delete(id);
    await loadDetail();
  };

  const addNote = async () => {
    if (!selected || !newNote.trim()) return;
    await window.api.notes.create({ client_id: selected.id, body: newNote.trim() });
    setNewNote('');
    await loadDetail();
  };

  const applyTemplate = (body: string) => setNewNote(body);

  const deleteNote = async (id: number) => {
    if (!confirm('Delete this note?')) return;
    await window.api.notes.delete(id);
    await loadDetail();
  };

  const exportReport = async () => {
    if (!selected) return;
    const r = await window.api.reports.clientPdf(selected.id);
    if (r.ok) toast('success', 'Client report exported', r.filePath ? `Saved to ${r.filePath}` : undefined);
    else toast('error', 'Export failed');
  };

  return (
    <div className="flex h-full">
      {/* Client list */}
      <div className="w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">Clients</h2>
          <button
            onClick={() => setEditingClient({ color: '#3b6ef5', stage: 'lead', deal_value: 0 })}
            className="p-1.5 rounded hover:bg-slate-100 text-brand-600"
            title="Add client"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {clients.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">No clients yet. Click + to add one.</div>
          )}
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ${
                selectedId === c.id ? 'bg-brand-50 border-l-2 border-brand-500' : ''
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                {c.company && <div className="text-xs text-slate-500 truncate">{c.company}</div>}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.stage}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="text-slate-500">Select or add a client to view details.</div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: selected.color }} />
                  <h1 className="text-2xl font-bold">{selected.name}</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">
                    {selected.stage}
                  </span>
                </div>
                {selected.company && <div className="text-slate-600 mt-1">{selected.company}</div>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveClientId(selected.id)}
                  className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600"
                >
                  Switch to this client
                </button>
                <button
                  onClick={exportReport}
                  className="p-2 rounded hover:bg-slate-100 text-brand-600"
                  title="Export client report (PDF)"
                >
                  <FileDown size={14} />
                </button>
                <button onClick={() => setEditingClient(selected)} className="p-2 rounded hover:bg-slate-100" title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteClient(selected.id)} className="p-2 rounded hover:bg-red-50 text-red-600" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white border border-slate-200 rounded-lg p-4">
              <div><div className="text-xs text-slate-500">Email</div><div className="text-sm">{selected.email || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Phone</div><div className="text-sm">{selected.phone || '—'}</div></div>
              <div><div className="text-xs text-slate-500">Pipeline stage</div><div className="text-sm capitalize">{selected.stage}</div></div>
              <div><div className="text-xs text-slate-500">Deal value</div><div className="text-sm">{Number(selected.deal_value || 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-slate-500">Hourly rate</div><div className="text-sm">{selected.hourly_rate ? `$${selected.hourly_rate}/hr` : '—'}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-500">Notes</div><div className="text-sm whitespace-pre-wrap">{selected.notes || '—'}</div></div>
            </div>

            {/* Brand Profile */}
            <BrandProfileSection client={selected} onSave={async (patch) => {
              await window.api.clients.update(selected.id, { ...selected, ...patch });
              await refresh();
              toast('success', 'Brand profile saved');
            }} />

            {/* Social accounts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Social Media Accounts</h2>
                <button
                  onClick={() => setEditingSocial({ platform: 'facebook' })}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600"
                >
                  <Plus size={14} /> Add account
                </button>
              </div>
              <div className="grid gap-2">
                {accounts.length === 0 && (
                  <div className="text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded p-4 text-center">
                    No accounts yet.
                  </div>
                )}
                {accounts.map((a) => {
                  const meta = platformMeta(a.platform);
                  const Icon = platformIcon(a.platform);
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
                      <div className="w-9 h-9 rounded-md flex items-center justify-center text-white" style={{ background: meta.color }}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{meta.label} {a.handle && <span className="text-slate-500 font-normal">· {a.handle}</span>}</div>
                        {a.username && <div className="text-xs text-slate-500">user: {a.username}</div>}
                        {a.notes && <div className="text-xs text-slate-500 truncate">{a.notes}</div>}
                      </div>
                      <div className="flex gap-1">
                        {a.url && (
                          <button onClick={() => window.api.social.open(a.url!)} className="p-2 rounded hover:bg-slate-100" title="Open">
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button onClick={() => setEditingSocial(a)} className="p-2 rounded hover:bg-slate-100">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteSocial(a.id)} className="p-2 rounded hover:bg-red-50 text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Website logins */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} />
                  <h2 className="font-semibold">Website Logins</h2>
                </div>
                <button
                  onClick={() => setEditingLogin({ label: '', url: '', username: '', password: '', notes: '' })}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600"
                >
                  <Plus size={14} /> Add login
                </button>
              </div>
              <div className="grid gap-2">
                {logins.length === 0 && (
                  <div className="text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded p-4 text-center">
                    No logins saved yet. Store CMS, hosting, analytics, or any website credentials here.
                  </div>
                )}
                {logins.map((l) => (
                  <LoginCard
                    key={l.id}
                    login={l}
                    onEdit={() => setEditingLogin(l)}
                    onDelete={() => deleteLogin(l.id)}
                    onOpen={() => l.url && window.api.websiteLogins.open(l.url)}
                  />
                ))}
              </div>
            </div>

            {/* Contract & Retainer */}
            <ContractSection client={selected} onSave={async (patch) => {
              await (window.api as any).clients_ext.setContract(selected.id, patch);
              await refresh();
              toast('success', 'Contract details saved');
            }} />

            {/* Onboarding Checklist */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare size={15} className="text-brand-500" />
                  <h2 className="font-semibold text-sm">Onboarding Checklist</h2>
                  <span className="text-xs text-slate-400">{checklists.filter((c) => c.done).length}/{checklists.length} done</span>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {checklists.length === 0 && (
                  <div className="text-xs text-slate-400 py-2 text-center">No items yet. Add steps to track client onboarding progress.</div>
                )}
                {checklists.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <button onClick={() => toggleCheckItem(item.id)} className="shrink-0">
                      {item.done ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-slate-400" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : ''}`}>{item.title}</span>
                    <button onClick={() => deleteCheckItem(item.id)} className="p-1 rounded hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCheckItem()} placeholder="Add checklist item…" className="flex-1 input text-sm" />
                <button onClick={addCheckItem} disabled={!newCheckItem.trim()} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">Add</button>
              </div>
            </div>

            {/* Activity log */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} />
                <h2 className="font-semibold">Activity Log</h2>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Ctrl+Enter to save</span>
                  <div className="relative group">
                    <button className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700">
                      <ChevronDown size={12} /> Templates
                    </button>
                    <div className="absolute right-0 top-5 z-10 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg min-w-44 py-1">
                      {NOTE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.label}
                          onClick={() => applyTemplate(tpl.body)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Log a call, meeting, update, or work note..."
                  className="w-full input"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote();
                  }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Send size={12} /> Add note
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {notes.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">No activity logged yet.</div>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm whitespace-pre-wrap flex-1">{n.body}</div>
                      <button onClick={() => deleteNote(n.id)} className="p-1 rounded hover:bg-red-50 text-red-500 opacity-50 hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1.5">{formatDateTime(n.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client edit modal */}
      <Modal
        open={editingClient !== null}
        onClose={() => setEditingClient(null)}
        title={editingClient?.id ? 'Edit Client' : 'New Client'}
      >
        {editingClient && (
          <div className="space-y-3">
            <Field label="Name *">
              <input
                autoFocus
                value={editingClient.name ?? ''}
                onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                className="w-full input"
              />
            </Field>
            <Field label="Company">
              <input
                value={editingClient.company ?? ''}
                onChange={(e) => setEditingClient({ ...editingClient, company: e.target.value })}
                className="w-full input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input
                  value={editingClient.email ?? ''}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  className="w-full input"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={editingClient.phone ?? ''}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full input"
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Pipeline stage">
                <select
                  value={editingClient.stage ?? 'lead'}
                  onChange={(e) => setEditingClient({ ...editingClient, stage: e.target.value as any })}
                  className="w-full input"
                >
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Deal value">
                <input
                  type="number"
                  value={editingClient.deal_value ?? 0}
                  onChange={(e) => setEditingClient({ ...editingClient, deal_value: Number(e.target.value) })}
                  className="w-full input"
                />
              </Field>
              <Field label="Hourly rate">
                <input
                  type="number"
                  value={editingClient.hourly_rate ?? 0}
                  onChange={(e) => setEditingClient({ ...editingClient, hourly_rate: Number(e.target.value) })}
                  className="w-full input"
                  placeholder="0.00"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <input
                  type="color"
                  value={editingClient.color ?? '#3b6ef5'}
                  onChange={(e) => setEditingClient({ ...editingClient, color: e.target.value })}
                  className="h-9 w-full rounded border border-slate-200"
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                rows={3}
                value={editingClient.notes ?? ''}
                onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                className="w-full input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingClient(null)} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={saveClient} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Social edit modal */}
      <Modal
        open={editingSocial !== null}
        onClose={() => setEditingSocial(null)}
        title={editingSocial?.id ? 'Edit Account' : 'Add Social Account'}
      >
        {editingSocial && (
          <div className="space-y-3">
            <Field label="Platform">
              <select
                value={editingSocial.platform ?? ''}
                onChange={(e) => setEditingSocial({ ...editingSocial, platform: e.target.value })}
                className="w-full input"
              >
                {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Handle / Page name">
              <input
                value={editingSocial.handle ?? ''}
                onChange={(e) => setEditingSocial({ ...editingSocial, handle: e.target.value })}
                className="w-full input"
                placeholder="@brandname"
              />
            </Field>
            <Field label="URL">
              <input
                value={editingSocial.url ?? ''}
                onChange={(e) => setEditingSocial({ ...editingSocial, url: e.target.value })}
                className="w-full input"
                placeholder="https://..."
              />
            </Field>
            <Field label="Login username">
              <input
                value={editingSocial.username ?? ''}
                onChange={(e) => setEditingSocial({ ...editingSocial, username: e.target.value })}
                className="w-full input"
              />
            </Field>
            <Field label="Notes">
              <textarea
                rows={2}
                value={editingSocial.notes ?? ''}
                onChange={(e) => setEditingSocial({ ...editingSocial, notes: e.target.value })}
                className="w-full input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingSocial(null)} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">Cancel</button>
              <button onClick={saveSocial} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">Save</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Website login edit modal */}
      <Modal
        open={editingLogin !== null}
        onClose={() => setEditingLogin(null)}
        title={editingLogin?.id ? 'Edit Login' : 'Add Website Login'}
      >
        {editingLogin && (
          <div className="space-y-3">
            <Field label="Label *">
              <input
                autoFocus
                value={editingLogin.label ?? ''}
                onChange={(e) => setEditingLogin({ ...editingLogin, label: e.target.value })}
                placeholder="e.g. WordPress Admin, cPanel, Google Analytics"
                className="w-full input"
              />
            </Field>
            <Field label="Website URL">
              <input
                value={editingLogin.url ?? ''}
                onChange={(e) => setEditingLogin({ ...editingLogin, url: e.target.value })}
                placeholder="https://example.com/wp-admin"
                className="w-full input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username / Email">
                <input
                  value={editingLogin.username ?? ''}
                  onChange={(e) => setEditingLogin({ ...editingLogin, username: e.target.value })}
                  className="w-full input"
                  autoComplete="off"
                />
              </Field>
              <Field label="Password">
                <input
                  type="text"
                  value={editingLogin.password ?? ''}
                  onChange={(e) => setEditingLogin({ ...editingLogin, password: e.target.value })}
                  className="w-full input font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                rows={2}
                value={editingLogin.notes ?? ''}
                onChange={(e) => setEditingLogin({ ...editingLogin, notes: e.target.value })}
                placeholder="2FA info, account owner, etc."
                className="w-full input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingLogin(null)} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">Cancel</button>
              <button onClick={saveLogin} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── ContractSection ─────────────────────────────────────────────────────────

function ContractSection({ client, onSave }: { client: Client; onSave: (patch: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    contract_start: '',
    contract_end: '',
    retainer_amount: 0,
    auto_renew: false,
    time_goal_ms: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      contract_start: client.contract_start ? new Date(client.contract_start).toISOString().slice(0, 10) : '',
      contract_end: client.contract_end ? new Date(client.contract_end).toISOString().slice(0, 10) : '',
      retainer_amount: client.retainer_amount || 0,
      auto_renew: !!client.auto_renew,
      time_goal_ms: client.time_goal_ms || 0,
    });
  }, [client.id, client.contract_start, client.contract_end, client.retainer_amount, client.auto_renew, client.time_goal_ms]);

  const save = async () => {
    setSaving(true);
    await onSave({
      contract_start: draft.contract_start ? new Date(draft.contract_start).getTime() : null,
      contract_end: draft.contract_end ? new Date(draft.contract_end).getTime() : null,
      retainer_amount: Number(draft.retainer_amount) || 0,
      auto_renew: draft.auto_renew,
      time_goal_ms: Number(draft.time_goal_ms) * 3600000, // convert hours to ms
    });
    setSaving(false);
  };

  const goalHours = client.time_goal_ms ? Math.round(client.time_goal_ms / 3600000) : 0;
  const daysLeft = client.contract_end ? Math.ceil((client.contract_end - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <FileText size={15} className="text-slate-600" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Contract & Retainer</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {client.contract_end
              ? daysLeft && daysLeft > 0
                ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}${client.auto_renew ? ' · auto-renew on' : ''}`
                : 'Contract expired'
              : 'No contract dates set'}
            {goalHours > 0 && ` · ${goalHours}h/month goal`}
          </div>
        </div>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Contract start</div>
              <input type="date" value={draft.contract_start} onChange={(e) => setDraft({ ...draft, contract_start: e.target.value })} className="w-full input text-sm" />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Contract end</div>
              <input type="date" value={draft.contract_end} onChange={(e) => setDraft({ ...draft, contract_end: e.target.value })} className="w-full input text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Monthly retainer ($)</div>
              <input type="number" value={draft.retainer_amount} onChange={(e) => setDraft({ ...draft, retainer_amount: Number(e.target.value) })} className="w-full input text-sm" placeholder="0.00" />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">
                <Target size={11} className="inline mr-1" />Monthly hour goal
              </div>
              <input type="number" value={draft.time_goal_ms ? Math.round(draft.time_goal_ms / 3600000) : 0} onChange={(e) => setDraft({ ...draft, time_goal_ms: Number(e.target.value) * 3600000 })} className="w-full input text-sm" placeholder="e.g. 20" />
            </label>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.auto_renew} onChange={(e) => setDraft({ ...draft, auto_renew: e.target.checked })} className="w-4 h-4 rounded" />
            <span className="text-sm flex items-center gap-1"><RefreshCw size={12} /> Auto-renew when contract expires</span>
          </label>
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BrandProfileSection ─────────────────────────────────────────────────────

const BRAND_FIELDS: { key: keyof Client; label: string; placeholder: string; rows?: number; hint?: string }[] = [
  {
    key: 'brand_about',
    label: 'About the brand',
    placeholder: 'What does this client do? Products, services, mission, unique value proposition…',
    rows: 3,
    hint: 'Used as the core brand context for all AI-generated content.',
  },
  {
    key: 'target_audience',
    label: 'Target audience',
    placeholder: 'Who are they targeting? Age, interests, location, pain points, buying behaviour…',
    rows: 2,
    hint: 'AI will tailor tone and messaging to this audience.',
  },
  {
    key: 'services',
    label: 'Key services / products',
    placeholder: 'List their main offerings: Social media management, SEO, web design…',
    rows: 2,
    hint: 'Referenced when generating promotional content.',
  },
  {
    key: 'brand_voice',
    label: 'Brand voice & personality',
    placeholder: 'Fun and relatable, never corporate. Use emojis. Avoid jargon. Short punchy sentences…',
    rows: 2,
    hint: 'AI will match this tone on every platform.',
  },
  {
    key: 'social_goals',
    label: 'Social media goals',
    placeholder: 'Grow Instagram followers, drive website traffic, generate leads, build brand awareness…',
    rows: 2,
    hint: 'Helps AI align content with business objectives.',
  },
  {
    key: 'keywords',
    label: 'Brand keywords & hashtags',
    placeholder: '#SkincarePH #GlowUp #CleanBeauty — also: "glow", "natural", "dermatologist-approved"…',
    rows: 2,
    hint: 'AI will incorporate these into posts where appropriate.',
  },
  {
    key: 'website',
    label: 'Website',
    placeholder: 'https://example.com',
    hint: 'Included in content when a CTA link is needed.',
  },
];

function BrandProfileSection({ client, onSave }: { client: Client; onSave: (patch: Partial<Client>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft({
      brand_about: client.brand_about ?? '',
      target_audience: client.target_audience ?? '',
      services: client.services ?? '',
      brand_voice: client.brand_voice ?? '',
      social_goals: client.social_goals ?? '',
      keywords: client.keywords ?? '',
      website: client.website ?? '',
    });
    setDirty(false);
  }, [client.id, client.brand_about, client.target_audience, client.services,
      client.brand_voice, client.social_goals, client.keywords, client.website]);

  const set = (key: keyof Client, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setDirty(false);
    setSaving(false);
  };

  const filled = BRAND_FIELDS.filter((f) => (client[f.key] as string | null)?.trim()).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-brand-600" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Brand Profile</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {filled === 0
              ? 'Add brand info so the AI Writer generates on-brand content automatically'
              : `${filled}/${BRAND_FIELDS.length} fields filled · AI will use this for all content`}
          </div>
        </div>
        {filled > 0 && (
          <div className="flex gap-0.5">
            {BRAND_FIELDS.map((f) => (
              <span
                key={f.key}
                className={`w-2 h-2 rounded-full ${(client[f.key] as string | null)?.trim() ? 'bg-brand-500' : 'bg-slate-200'}`}
                title={f.label}
              />
            ))}
          </div>
        )}
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div className="flex items-start gap-2 p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-800">
            <Sparkles size={12} className="shrink-0 mt-0.5" />
            <span>
              Everything you fill in here is automatically sent to the AI Writer when this client is selected.
              The more detail you add, the more on-brand the content will be.
            </span>
          </div>

          <div className="grid gap-4">
            {BRAND_FIELDS.map((f) => (
              <div key={String(f.key)}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">{f.label}</label>
                  {f.hint && <span className="text-[10px] text-slate-400 italic">{f.hint}</span>}
                </div>
                {f.rows && f.rows > 1 ? (
                  <textarea
                    rows={f.rows}
                    value={(draft[f.key] as string) ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full input text-sm resize-none"
                  />
                ) : (
                  <input
                    value={(draft[f.key] as string) ?? ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full input text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 font-medium"
            >
              {saving ? <Sparkles size={14} className="animate-pulse" /> : <Save size={14} />}
              {saving ? 'Saving…' : dirty ? 'Save brand profile' : 'Saved ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LoginCard ────────────────────────────────────────────────────────────────

function LoginCard({
  login, onEdit, onDelete, onOpen,
}: { login: WebsiteLogin; onEdit: () => void; onDelete: () => void; onOpen: () => void }) {
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState<'user' | 'pwd' | null>(null);

  const copy = (text: string, field: 'user' | 'pwd') => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  // Derive a simple icon color from the label/URL
  const hue = [...(login.label)].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const iconBg = `hsl(${hue}, 55%, 48%)`;

  return (
    <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3">
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5"
        style={{ background: iconBg }}
      >
        <Globe size={17} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="font-medium text-sm">{login.label}</div>

        {login.url && (
          <button
            onClick={onOpen}
            className="text-xs text-brand-500 hover:underline truncate block max-w-xs text-left"
          >
            {login.url}
          </button>
        )}

        {/* Username row */}
        {login.username && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-14 shrink-0">Username</span>
            <span className="text-xs font-mono text-slate-700 flex-1 truncate">{login.username}</span>
            <button
              onClick={() => copy(login.username!, 'user')}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              title="Copy username"
            >
              {copied === 'user' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {/* Password row */}
        {login.password && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-14 shrink-0">Password</span>
            <span className="text-xs font-mono text-slate-700 flex-1 truncate">
              {showPwd ? login.password : '••••••••••••'}
            </span>
            <button
              onClick={() => setShowPwd(!showPwd)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              title={showPwd ? 'Hide' : 'Show'}
            >
              {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              onClick={() => copy(login.password!, 'pwd')}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              title="Copy password"
            >
              {copied === 'pwd' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {login.notes && (
          <div className="text-xs text-slate-400 italic truncate">{login.notes}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        {login.url && (
          <button onClick={onOpen} className="p-2 rounded hover:bg-slate-100" title="Open URL">
            <ExternalLink size={14} />
          </button>
        )}
        <button onClick={onEdit} className="p-2 rounded hover:bg-slate-100" title="Edit">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="p-2 rounded hover:bg-red-50 text-red-500" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
