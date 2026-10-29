import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, ArrowRight, Copy } from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useAgency } from '../state/AgencyContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/utils';
import type { Proposal, InvoiceItem, ProposalStatus } from '../types';

const STATUSES: { id: ProposalStatus; label: string; color: string }[] = [
  { id: 'draft',    label: 'Draft',    color: 'bg-slate-100 text-slate-700' },
  { id: 'sent',     label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  { id: 'accepted', label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
];

const blankItem = (): InvoiceItem => ({ description: '', quantity: 1, unit_price: 0 });

export default function Proposals() {
  const { clients, activeClientId } = useClients();
  const { agency } = useAgency();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [editing, setEditing] = useState<Partial<Proposal> | null>(null);

  const reload = useCallback(async () => {
    setProposals(await window.api.proposals.list({ clientId: activeClientId }));
  }, [activeClientId]);

  useEffect(() => { reload(); }, [reload]);

  const startNew = async () => {
    const number = await window.api.proposals.nextNumber();
    setEditing({
      number, issue_date: Date.now(),
      valid_until: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'draft', client_id: activeClientId ?? null,
      items: [blankItem()], tax_rate: 0, discount: 0, notes: '',
    });
  };

  const save = async () => {
    if (!editing || !editing.number) return;
    const cleaned = { ...editing, items: (editing.items || []).filter((i) => i.description.trim()) };
    if (editing.id) await window.api.proposals.update(editing.id, cleaned);
    else await window.api.proposals.create(cleaned);
    setEditing(null);
    await reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this proposal?')) return;
    await window.api.proposals.delete(id);
    await reload();
  };

  const exportPdf = async (id: number) => {
    const r = await window.api.proposals.exportPdf(id);
    if (r.ok) toast('success', 'Proposal exported', r.filePath);
    else toast('error', 'Export failed', r.error);
  };

  const convertToInvoice = async (id: number, number: string) => {
    if (!confirm(`Convert proposal ${number} to an invoice?`)) return;
    const r = await window.api.proposals.convertToInvoice(id);
    if (r.ok) {
      toast('success', 'Invoice created', `Invoice ready in the Invoices page.`);
      await reload();
    } else {
      toast('error', 'Conversion failed', r.error);
    }
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    if (!editing) return;
    const items = [...(editing.items || [])];
    items[idx] = { ...items[idx], ...patch };
    setEditing({ ...editing, items });
  };

  const sub = editing ? (editing.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0) : 0;
  const tax = editing ? ((sub - (editing.discount || 0)) * (editing.tax_rate || 0)) / 100 : 0;
  const total = sub - (editing?.discount || 0) + tax;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Proposals & Quotes</h1>
          <p className="text-sm text-slate-500">{activeClientId ? 'Filtered to active client' : 'All clients'}</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">
          <Plus size={14} /> New proposal
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Number</th>
              <th className="text-left px-4 py-2.5">Client</th>
              <th className="text-left px-4 py-2.5">Issued</th>
              <th className="text-left px-4 py-2.5">Valid until</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {proposals.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No proposals yet. Click "New proposal" to create one.</td></tr>
            )}
            {proposals.map((p) => {
              const status = STATUSES.find((s) => s.id === p.status)!;
              const expired = p.valid_until && p.valid_until < Date.now() && p.status === 'sent';
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{p.number}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.client_name || '—'}</div>
                    {p.client_company && <div className="text-xs text-slate-400">{p.client_company}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(p.issue_date)}</td>
                  <td className={`px-4 py-2.5 ${expired ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                    {formatDate(p.valid_until)}{expired && ' ⚠'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                    {p.converted_invoice_id && <span className="ml-2 text-[10px] text-emerald-600">→ Invoiced</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {agency.currency} {(p.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => exportPdf(p.id)} className="p-1.5 rounded hover:bg-slate-100" title="Export PDF"><FileDown size={14} /></button>
                      {!p.converted_invoice_id && p.status === 'accepted' && (
                        <button onClick={() => convertToInvoice(p.id, p.number)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Convert to invoice">
                          <ArrowRight size={14} />
                        </button>
                      )}
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-slate-100" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor modal */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.number}` : 'New Proposal'} width="max-w-3xl">
        {editing && (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Number">
                <input value={editing.number ?? ''} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="w-full input" />
              </Field>
              <Field label="Client">
                <select value={editing.client_id ?? ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value ? Number(e.target.value) : null })} className="w-full input">
                  <option value="">— None —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={editing.status ?? 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProposalStatus })} className="w-full input">
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issue date">
                <input type="date" value={editing.issue_date ? new Date(editing.issue_date).toISOString().slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, issue_date: e.target.value ? new Date(e.target.value).getTime() : Date.now() })} className="w-full input" />
              </Field>
              <Field label="Valid until">
                <input type="date" value={editing.valid_until ? new Date(editing.valid_until).toISOString().slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, valid_until: e.target.value ? new Date(e.target.value).getTime() : null })} className="w-full input" />
              </Field>
            </div>

            {/* Line items */}
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1.5">Line items</div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2 w-20">Qty</th>
                      <th className="text-right px-3 py-2 w-28">Unit price</th>
                      <th className="text-right px-3 py-2 w-24">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(editing.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1.5"><input value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} className="w-full input text-xs" placeholder="Service description" /></td>
                        <td className="px-2 py-1.5"><input type="number" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="w-full input text-xs text-right" /></td>
                        <td className="px-2 py-1.5"><input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} className="w-full input text-xs text-right" /></td>
                        <td className="px-3 py-1.5 text-right text-xs font-mono">{(item.quantity * item.unit_price).toFixed(2)}</td>
                        <td className="px-1 py-1.5 text-center">
                          <button onClick={() => setEditing({ ...editing, items: (editing.items || []).filter((_, i) => i !== idx) })} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-slate-100">
                  <button onClick={() => setEditing({ ...editing, items: [...(editing.items || []), blankItem()] })} className="text-xs text-brand-500 hover:underline">+ Add line item</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount">
                <input type="number" value={editing.discount ?? 0} onChange={(e) => setEditing({ ...editing, discount: Number(e.target.value) })} className="w-full input" />
              </Field>
              <Field label="Tax rate (%)">
                <input type="number" value={editing.tax_rate ?? 0} onChange={(e) => setEditing({ ...editing, tax_rate: Number(e.target.value) })} className="w-full input" />
              </Field>
            </div>
            <div className="text-right text-sm font-semibold">
              Total: {agency.currency} {total.toFixed(2)}
            </div>
            <Field label="Notes">
              <textarea rows={2} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="w-full input" placeholder="Payment terms, scope, conditions…" />
            </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
