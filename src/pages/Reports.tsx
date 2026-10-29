import { useEffect, useState } from 'react';
import { FileDown, ChevronLeft, ChevronRight, Loader2, TableProperties } from 'lucide-react';
import { useAgency } from '../state/AgencyContext';
import { useClients } from '../state/ClientContext';
import { useToast } from '../state/ToastContext';
import { formatDuration } from '../lib/utils';

function getMondayOfWeek(offset = 0): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function fmtWeekLabel(monday: string) {
  const [y, m, d] = monday.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function Reports() {
  const { agency } = useAgency();
  const { clients, activeClientId } = useClients();
  const { toast } = useToast();
  const [revenue, setRevenue] = useState<{ month: string; paid: number; outstanding: number }[]>([]);
  const [byClient, setByClient] = useState<{ client_id: number; name: string; color: string; ms: number }[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, { count: number; value: number }>>({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    window.api.stats.revenueByMonth().then(setRevenue);
    window.api.stats.timeByClient().then(setByClient);
    window.api.stats.pipelineValue().then(setPipeline);
  }, []);

  const exportWeekly = async () => {
    setExporting(true);
    const weekStart = getMondayOfWeek(weekOffset);
    const r = await window.api.reports.weeklyPdf({ clientId: activeClientId, weekStart });
    if (r.ok) toast('success', 'Weekly report exported', r.filePath ? `Saved to ${r.filePath}` : undefined);
    else toast('error', 'Export failed', (r as any).error);
    setExporting(false);
  };

  const exportCsv = async (type: 'invoices' | 'timeEntries' | 'clients') => {
    const fns = {
      invoices: () => (window.api.exports as any).invoicesCsv({ clientId: activeClientId }),
      timeEntries: () => (window.api.exports as any).timeEntriesCsv({ clientId: activeClientId }),
      clients: () => (window.api.exports as any).clientsCsv(),
    };
    const r = await fns[type]();
    if (r.ok) toast('success', `${type === 'timeEntries' ? 'Time entries' : type.charAt(0).toUpperCase() + type.slice(1)} CSV exported`, r.filePath);
    else toast('error', 'Export failed', r.error);
  };

  const maxRevenue = Math.max(1, ...revenue.flatMap((r) => [r.paid + r.outstanding]));
  const maxTime = Math.max(1, ...byClient.map((c) => c.ms));
  const totalPaid = revenue.reduce((s, r) => s + r.paid, 0);
  const totalOutstanding = revenue.reduce((s, r) => s + r.outstanding, 0);
  const pipelineValue = Object.values(pipeline).reduce((s, v) => s + v.value, 0);
  const stageOrder = ['lead', 'contacted', 'proposal', 'won', 'lost'];
  const monday = getMondayOfWeek(weekOffset);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Performance across clients, revenue, time, and pipeline.</p>
        </div>

        {/* CSV exports */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1"><TableProperties size={12} /> Export CSV:</span>
          {(['invoices', 'timeEntries', 'clients'] as const).map((t) => (
            <button
              key={t}
              onClick={() => exportCsv(t)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <FileDown size={12} />
              {t === 'timeEntries' ? 'Time Entries' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly report export */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1 rounded hover:bg-slate-100">
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm text-center min-w-44">
            <div className="font-medium text-slate-700">{fmtWeekLabel(monday)}</div>
            <div className="text-xs text-slate-400">Weekly report</div>
          </div>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1 rounded hover:bg-slate-100" disabled={weekOffset >= 0}>
            <ChevronRight size={16} className={weekOffset >= 0 ? 'text-slate-300' : ''} />
          </button>
          <button
            onClick={exportWeekly}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            Export PDF
          </button>
        </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Paid revenue (12 mo)" value={`${agency.currency} ${totalPaid.toLocaleString()}`} accent="text-emerald-600" />
        <Stat label="Outstanding" value={`${agency.currency} ${totalOutstanding.toLocaleString()}`} accent="text-amber-600" />
        <Stat label="Pipeline value" value={`${agency.currency} ${pipelineValue.toLocaleString()}`} accent="text-brand-600" />
      </div>

      <Panel title="Revenue by month">
        {revenue.length === 0 ? <Empty>No invoices yet.</Empty> : (
          <div className="space-y-2">
            <div className="flex items-end gap-2 h-48">
              {revenue.map((r) => {
                const total = r.paid + r.outstanding;
                const h = (total / maxRevenue) * 100;
                const paidH = total ? (r.paid / total) * h : 0;
                const outH = h - paidH;
                return (
                  <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-slate-500 font-mono">{total ? Math.round(total).toLocaleString() : ''}</div>
                    <div className="w-full flex-1 flex flex-col justify-end" title={`Paid ${r.paid.toFixed(0)} · Outstanding ${r.outstanding.toFixed(0)}`}>
                      <div className="w-full bg-amber-400" style={{ height: `${outH}%` }} />
                      <div className="w-full bg-emerald-500" style={{ height: `${paidH}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-500">{r.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Paid</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded-sm" /> Outstanding</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Time tracked by client">
        {byClient.length === 0 ? <Empty>No tracked time yet.</Empty> : (
          <div className="space-y-2">
            {byClient.slice(0, 10).map((c) => {
              const pct = (c.ms / maxTime) * 100;
              return (
                <div key={c.client_id} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <div className="text-sm w-40 truncate">{c.name}</div>
                  <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <div className="text-sm font-mono text-slate-600 w-24 text-right">{formatDuration(c.ms)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Pipeline by stage">
        <div className="grid grid-cols-5 gap-3">
          {stageOrder.map((s) => {
            const v = pipeline[s] || { count: 0, value: 0 };
            return (
              <div key={s} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide">{s}</div>
                <div className="text-xl font-bold mt-1">{v.count}</div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">
                  {agency.currency} {v.value.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 py-6 text-center">{children}</div>;
}
