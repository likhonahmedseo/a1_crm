import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, Eye, Receipt, Clock, Copy, Mail } from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useAgency } from '../state/AgencyContext';
import { Modal } from '../components/Modal';
import { useToast } from '../state/ToastContext';
import { formatDate, formatDuration } from '../lib/utils';
import type { Invoice, InvoiceItem, InvoiceStatus, TimeEntry } from '../types';

const STATUSES: { id: InvoiceStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  { id: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  { id: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-700' },
];

const blankItem = (): InvoiceItem => ({ description: '', quantity: 1, unit_price: 0 });

export default function Invoices() {
  const { clients, activeClientId } = useClients();
  const { agency } = useAgency();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState<Partial<Invoice> | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [fromEntries, setFromEntries] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [fromClientId, setFromClientId] = useState<number | ''>(activeClientId ?? '');
  const [hourlyRate, setHourlyRate] = useState(0);

  const reload = useCallback(async () => {
    setInvoices(await window.api.invoices.list({ clientId: activeClientId }));
  }, [activeClientId]);

  useEffect(() => { reload(); }, [reload]);

  const openFromEntries = async () => {
    const cid = activeClientId ?? (clients[0]?.id ?? null);
    setFromClientId(cid ?? '');
    if (cid) {
      const entries = await window.api.tracker.entries({ clientId: cid });
      const done = entries.filter((e: any) => e.status === 'done' && (e.duration_ms || e.accumulated_ms));
      setTimeEntries(done);
      const client = clients.find((c) => c.id === cid);
      setHourlyRate(client?.hourly_rate || 0);
    } else {
      setTimeEntries([]);
    }
    setSelectedEntryIds([]);
    setFromEntries(true);
  };

  const loadEntriesForClient = async (cid: number) => {
    const entries = await window.api.tracker.entries({ clientId: cid });
    const done = entries.filter((e: any) => e.status === 'done' && (e.duration_ms || e.accumulated_ms));
    setTimeEntries(done);
    const client = clients.find((c) => c.id === cid);
    setHourlyRate(client?.hourly_rate || 0);
    setSelectedEntryIds([]);
  };

  const createFromEntries = async () => {
    if (!fromClientId || !selectedEntryIds.length || !hourlyRate) {
      toast('error', 'Select client, entries, and hourly rate');
      return;
    }
    const r = await (window.api.invoices as any).fromTimeEntries({
      clientId: Number(fromClientId),
      entryIds: selectedEntryIds,
      hourlyRate,
    });
    if (r.ok) {
      toast('success', 'Invoice created', `Invoice ${r.number} from time entries.`);
      setFromEntries(false);
      await reload();
    } else {
      toast('error', 'Failed', r.error);
    }
  };

  const startNew = async () => {
    const number = await window.api.invoices.nextNumber();
    setEditing({
      number,
      issue_date: Date.now(),
      due_date: Date.now() + 14 * 24 * 60 * 60 * 1000,
      status: 'draft',
      client_id: activeClientId ?? null,
      items: [blankItem()],
      tax_rate: 0,
      discount: 0,
      notes: '',
    });
  };

  const save = async () => {
    if (!editing || !editing.number) return;
    const cleaned = {
      ...editing,
      items: (editing.items || []).filter((i) => i.description.trim()),
    };
    if (editing.id) await window.api.invoices.update(editing.id, cleaned);
    else await window.api.invoices.create(cleaned);
    setEditing(null);
    await reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this invoice?')) return;
    await window.api.invoices.delete(id);
    await reload();
  };

  const preview = async (id: number | null, sample = false) => {
    const html = await window.api.invoices.renderHtml(id, sample);
    setPreviewHtml(html);
  };

  const exportPdf = async (id: number) => {
    const r = await window.api.invoices.exportPdf(id);
    if (r.ok) toast('success', 'Invoice exported', r.filePath ? `Saved to ${r.filePath}` : undefined);
    else toast('error', 'Export failed', r.error);
  };

  const exportSample = async () => {
    const r = await window.api.invoices.exportSamplePdf();
    if (r.ok) toast('success', 'Sample invoice exported');
    else toast('error', 'Export failed');
  };

  const duplicate = async (inv: Invoice) => {
    const number = await window.api.invoices.nextNumber();
    const copy = {
      ...inv,
      id: undefined,
      number,
      issue_date: Date.now(),
      due_date: Date.now() + 14 * 24 * 60 * 60 * 1000,
      status: 'draft' as InvoiceStatus,
    };
    delete (copy as any).id;
    await window.api.invoices.create(copy);
    toast('success', 'Invoice duplicated', `Created as ${number}`);
    await reload();
  };

  const copyChaseEmail = (inv: Invoice) => {
    const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'the due date';
    const amt = `${agency.currency}${(inv.total || 0).toFixed(2)}`;
    const text = `Subject: Friendly reminder — Invoice ${inv.number} overdue\n\nHi ${inv.client_name || 'there'},\n\nI hope you're doing well! I wanted to follow up on invoice ${inv.number} for ${amt}, which was due on ${dueStr}.\n\nCould you please let me know when we can expect payment? If you have any questions or concerns about the invoice, I'm happy to help.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\n${agency.name}`;
    navigator.clipboard.writeText(text).then(() => {
      toast('success', 'Chase email copied', 'Paste it into your email client.');
    });
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    if (!editing) return;
    const items = [...(editing.items || [])];
    items[idx] = { ...items[idx], ...patch };
    setEditing({ ...editing, items });
  };

  const addItem = () => {
    if (!editing) return;
    setEditing({ ...editing, items: [...(editing.items || []), blankItem()] });
  };

  const removeItem = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, items: (editing.items || []).filter((_, i) => i !== idx) });
  };

  // computed totals for live editor
  const editorSubtotal = editing
    ? (editing.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0)
    : 0;
  const editorTax = editing ? ((editorSubtotal - (editing.discount || 0)) * (editing.tax_rate || 0)) / 100 : 0;
  const editorTotal = editorSubtotal - (editing?.discount || 0) + editorTax;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-slate-500">
            {activeClientId ? 'Filtered to active client' : 'All clients'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => preview(null, true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            <Receipt size={14} /> Sample preview
          </button>
          <button
            onClick={exportSample}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            <FileDown size={14} /> Sample PDF
          </button>
          <button
            onClick={openFromEntries}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            <Clock size={14} /> From time entries
          </button>
          <button
            onClick={startNew}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600"
          >
            <Plus size={14} /> New invoice
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Number</th>
              <th className="text-left px-4 py-2.5">Client</th>
              <th className="text-left px-4 py-2.5">Issued</th>
              <th className="text-left px-4 py-2.5">Due</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No invoices yet. Click "New invoice" to create one.
                </td>
              </tr>
            )}
            {invoices.map((i) => {
              const status = STATUSES.find((s) => s.id === i.status)!;
              return (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{i.number}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{i.client_name || '—'}</div>
                    {i.client_company && <div className="text-xs text-slate-500">{i.client_company}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(i.issue_date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(i.due_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {agency.currency} {(i.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => preview(i.id)} className="p-1.5 rounded hover:bg-slate-100" title="Preview">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => exportPdf(i.id)} className="p-1.5 rounded hover:bg-slate-100" title="Export PDF">
                        <FileDown size={14} />
                      </button>
                      <button onClick={() => duplicate(i)} className="p-1.5 rounded hover:bg-slate-100" title="Duplicate invoice">
                        <Copy size={14} />
                      </button>
                      {(i.status === 'overdue' || i.status === 'sent') && (
                        <button onClick={() => copyChaseEmail(i)} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Copy chase reminder email">
                          <Mail size={14} />
                        </button>
                      )}
                      <button onClick={() => setEditing(i)} className="p-1.5 rounded hover:bg-slate-100" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(i.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit Invoice ${editing.number}` : 'New Invoice'}
        width="max-w-3xl"
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Number">
                <input
                  value={editing.number ?? ''}
                  onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                  className="w-full input"
                />
              </Field>
              <Field label="Client">
                <select
                  value={editing.client_id ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, client_id: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full input"
                >
                  <option value="">— None —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={editing.status ?? 'draft'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as InvoiceStatus })}
                  className="w-full input"
                >
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date">
                <input
                  type="date"
                  value={editing.issue_date ? new Date(editing.issue_date).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    setEditing({ ...editing, issue_date: e.target.value ? new Date(e.target.value).getTime() : Date.now() })
                  }
                  className="w-full input"
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={editing.due_date ? new Date(editing.due_date).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    setEditing({ ...editing, due_date: e.target.value ? new Date(e.target.value).getTime() : null })
                  }
                  className="w-full input"
                />
              </Field>
            </div>

            {/* Items */}
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Line items</div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">Description</th>
                      <th className="text-right px-2 py-1.5 w-20">Qty</th>
                      <th className="text-right px-2 py-1.5 w-28">Unit price</th>
                      <th className="text-right px-2 py-1.5 w-28">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(editing.items || []).map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-2 py-1">
                          <input
                            value={it.description}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            className="w-full input"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            className="w-full input text-right"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={it.unit_price}
                            onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                            className="w-full input text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {(it.quantity * it.unit_price).toFixed(2)}
                        </td>
                        <td className="px-1">
                          <button onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addItem}
                className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <Plus size={12} /> Add item
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Discount">
                <input
                  type="number"
                  step="0.01"
                  value={editing.discount ?? 0}
                  onChange={(e) => setEditing({ ...editing, discount: Number(e.target.value) })}
                  className="w-full input"
                />
              </Field>
              <Field label="Tax rate (%)">
                <input
                  type="number"
                  step="0.01"
                  value={editing.tax_rate ?? 0}
                  onChange={(e) => setEditing({ ...editing, tax_rate: Number(e.target.value) })}
                  className="w-full input"
                />
              </Field>
              <div className="self-end text-right">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-xl font-bold text-brand-600">
                  {agency.currency} {editorTotal.toFixed(2)}
                </div>
              </div>
            </div>

            <Field label="Notes">
              <textarea
                rows={2}
                value={editing.notes ?? ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="w-full input"
                placeholder="Payment terms, thank-you message..."
              />
            </Field>

            <div className="flex justify-between gap-2 pt-2">
              <button
                onClick={async () => {
                  if (!editing.id) {
                    // preview unsaved? save first to get an id
                    await save();
                    return;
                  }
                  preview(editing.id);
                }}
                className="px-3 py-1.5 text-sm rounded border border-slate-200 hover:bg-slate-50"
              >
                Preview
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">Cancel</button>
                <button onClick={save} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* From time entries modal */}
      <Modal open={fromEntries} onClose={() => setFromEntries(false)} title="Create invoice from time entries" width="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Client *</div>
              <select
                value={fromClientId}
                onChange={(e) => { const v = Number(e.target.value); setFromClientId(v); loadEntriesForClient(v); }}
                className="w-full input"
              >
                <option value="">— Select client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600 mb-1">Hourly rate *</div>
              <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full input" placeholder="0.00" />
            </label>
          </div>
          {timeEntries.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4 border border-dashed border-slate-200 rounded-lg">
              No completed time sessions found for this client.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-auto">
              {timeEntries.map((e: any) => {
                const ms = e.duration_ms || e.accumulated_ms || 0;
                const hrs = (ms / 3600000).toFixed(2);
                const checked = selectedEntryIds.includes(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => setSelectedEntryIds(checked ? selectedEntryIds.filter((id) => id !== e.id) : [...selectedEntryIds, e.id])} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.description || e.date || 'Session'}</div>
                      <div className="text-xs text-slate-400">{e.date}</div>
                    </div>
                    <div className="text-sm font-mono text-slate-600 shrink-0">{hrs}h · {formatDuration(ms)}</div>
                    {hourlyRate > 0 && <div className="text-sm font-mono text-emerald-600 shrink-0">{agency.currency}{(Number(hrs) * hourlyRate).toFixed(2)}</div>}
                  </label>
                );
              })}
            </div>
          )}
          {selectedEntryIds.length > 0 && hourlyRate > 0 && (
            <div className="flex justify-between items-center text-sm bg-slate-50 rounded-lg px-4 py-2">
              <span className="text-slate-600">{selectedEntryIds.length} sessions selected</span>
              <span className="font-semibold text-emerald-700">
                Total: {agency.currency}{timeEntries.filter((e: any) => selectedEntryIds.includes(e.id)).reduce((s, e: any) => s + ((e.duration_ms || e.accumulated_ms || 0) / 3600000) * hourlyRate, 0).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setFromEntries(false)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100">Cancel</button>
            <button onClick={createFromEntries} disabled={!selectedEntryIds.length || !hourlyRate} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              Create invoice
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview */}
      {previewHtml !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setPreviewHtml(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="font-semibold">Invoice preview</h3>
              <button onClick={() => setPreviewHtml(null)} className="p-1 rounded hover:bg-slate-100 text-sm">Close</button>
            </div>
            <iframe srcDoc={previewHtml} className="w-full h-[80vh]" sandbox="" />
          </div>
        </div>
      )}
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
