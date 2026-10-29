import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, Receipt, DollarSign } from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useAgency } from '../state/AgencyContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';
import { formatDate } from '../lib/utils';
import type { Expense, ExpenseCategory } from '../types';

const CATEGORIES: { id: ExpenseCategory; label: string; color: string }[] = [
  { id: 'tools',      label: 'Tools & Software', color: 'bg-blue-100 text-blue-700' },
  { id: 'ads',        label: 'Ad Spend',          color: 'bg-violet-100 text-violet-700' },
  { id: 'freelancer', label: 'Freelancer',         color: 'bg-amber-100 text-amber-700' },
  { id: 'travel',     label: 'Travel',             color: 'bg-emerald-100 text-emerald-700' },
  { id: 'office',     label: 'Office',             color: 'bg-slate-100 text-slate-700' },
  { id: 'other',      label: 'Other',              color: 'bg-pink-100 text-pink-700' },
];

const catMeta = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

function todayYMD() { return new Date().toISOString().slice(0, 10); }

export default function Expenses() {
  const { clients, activeClientId } = useClients();
  const { agency } = useAgency();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const [filterMonth, setFilterMonth] = useState('');

  const reload = useCallback(async () => {
    const list = await window.api.expenses.list({ clientId: activeClientId, month: filterMonth || undefined });
    setExpenses(list);
  }, [activeClientId, filterMonth]);

  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!editing || !editing.description) return;
    if (editing.id) await window.api.expenses.update(editing.id, editing);
    else await window.api.expenses.create({ ...editing, client_id: editing.client_id ?? activeClientId ?? null });
    setEditing(null);
    await reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    await window.api.expenses.delete(id);
    await reload();
  };

  const exportCsv = async () => {
    const r = await window.api.expenses.exportCsv({ clientId: activeClientId });
    if (r.ok) toast('success', 'Expenses exported', r.filePath ? `Saved to ${r.filePath}` : undefined);
    else toast('error', 'Export cancelled');
  };

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const billableAmount = expenses.filter((e) => e.billable).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt size={22} className="text-brand-500" /> Expenses
          </h1>
          <p className="text-sm text-slate-500">{activeClientId ? 'Filtered to active client' : 'All clients'}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="input text-sm"
            placeholder="Filter by month"
          />
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50">
            <FileDown size={14} /> CSV
          </button>
          <button
            onClick={() => setEditing({ date: todayYMD(), category: 'other', billable: true, amount: 0 })}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600"
          >
            <Plus size={14} /> New expense
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total expenses</div>
          <div className="text-xl font-bold mt-1">{agency.currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Billable</div>
          <div className="text-xl font-bold mt-1 text-emerald-600">{agency.currency} {billableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Non-billable</div>
          <div className="text-xl font-bold mt-1 text-slate-600">{agency.currency} {(totalAmount - billableAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Client</th>
              <th className="text-left px-4 py-2.5">Category</th>
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-left px-4 py-2.5">Billable</th>
              <th className="text-right px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No expenses yet. Click "New expense" to add one.</td></tr>
            )}
            {expenses.map((e) => {
              const cat = catMeta(e.category);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{e.date}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.client_name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cat.color}`}>{cat.label}</span>
                  </td>
                  <td className="px-4 py-2.5 max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${e.billable ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {e.billable ? '✓ Billable' : 'Non-billable'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">
                    {agency.currency} {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(e)} className="p-1.5 rounded hover:bg-slate-100"><Pencil size={14} /></button>
                      <button onClick={() => remove(e.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Expense' : 'New Expense'}>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input type="date" value={editing.date ?? todayYMD()} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full input" />
              </Field>
              <Field label="Client">
                <select value={editing.client_id ?? ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value ? Number(e.target.value) : null })} className="w-full input">
                  <option value="">— None —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description *">
              <input autoFocus value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full input" placeholder="e.g. Canva Pro subscription" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={editing.category ?? 'other'} onChange={(e) => setEditing({ ...editing, category: e.target.value as ExpenseCategory })} className="w-full input">
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label={`Amount (${agency.currency})`}>
                <input type="number" step="0.01" value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} className="w-full input" />
              </Field>
            </div>
            <Field label="Receipt / notes">
              <input value={editing.receipt_note ?? ''} onChange={(e) => setEditing({ ...editing, receipt_note: e.target.value })} className="w-full input" placeholder="Invoice #, receipt link, etc." />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!editing.billable} onChange={(e) => setEditing({ ...editing, billable: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm font-medium">Billable to client</span>
            </label>
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
