import { useEffect, useState } from 'react';
import {
  Users, ListTodo, CheckCircle2, Clock, Receipt, TrendingUp,
  AlertTriangle, FileText, CalendarClock,
} from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useAgency } from '../state/AgencyContext';
import { formatDuration, formatDateTime, formatDate } from '../lib/utils';
import type { Task, TimeEntry, Invoice, Client } from '../types';

interface ClientCard {
  client: Client;
  openTasks: number;
  trackedMsMonth: number;
  lastActivity: number | null;
  outstandingAmt: number;
  healthScore: number; // 0-100
}

function calcHealthScore(openTasks: number, lastActivity: number | null, outstandingAmt: number, trackedMsMonth: number): number {
  let score = 100;
  // Deduct for open tasks stacking up
  score -= Math.min(30, openTasks * 5);
  // Deduct if no activity in > 7 days
  if (lastActivity) {
    const daysSince = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
    if (daysSince > 14) score -= 30;
    else if (daysSince > 7) score -= 15;
  } else {
    score -= 20;
  }
  // Deduct for outstanding invoices
  if (outstandingAmt > 0) score -= 20;
  // Boost for active tracking this month
  if (trackedMsMonth > 0) score += 10;
  return Math.max(0, Math.min(100, score));
}

function healthColor(score: number) {
  if (score >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600', label: 'Healthy' };
  if (score >= 45) return { bar: 'bg-amber-400', text: 'text-amber-600', label: 'Needs attention' };
  return { bar: 'bg-red-500', text: 'text-red-600', label: 'At risk' };
}

export default function Dashboard() {
  const { clients, activeClient, activeClientId } = useClients();
  const { agency } = useAgency();

  const [stats, setStats] = useState({ totalClients: 0, openTasks: 0, doneTasks: 0, trackedMs: 0 });
  const [revenue, setRevenue] = useState<{ paid: number; outstanding: number }>({ paid: 0, outstanding: 0 });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [clientCards, setClientCards] = useState<ClientCard[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [contractAlerts, setContractAlerts] = useState<any[]>([]);

  useEffect(() => {
    window.api.stats.dashboard(activeClientId).then(setStats);
    window.api.tasks.list({ clientId: activeClientId }).then((t) => setRecentTasks(t.slice(0, 5)));
    window.api.tracker.entries({ clientId: activeClientId }).then((e) => setRecentEntries(e.slice(0, 5)));
    window.api.invoices.list({ clientId: activeClientId }).then((inv) => {
      setRecentInvoices(inv.slice(0, 5));
      const paid = inv.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
      const outstanding = inv
        .filter((i) => i.status === 'sent' || i.status === 'overdue')
        .reduce((s, i) => s + (i.total || 0), 0);
      setRevenue({ paid, outstanding });
    });
    window.api.tasks.dueAlerts().then((alerts: any[]) => {
      setOverdueCount(alerts.filter((a) => a.isOverdue).length);
    });
    (window.api.stats as any).overdueInvoices().then(setOverdueInvoices);
    (window.api.stats as any).contractAlerts().then(setContractAlerts);
  }, [activeClientId]);

  useEffect(() => {
    if (activeClientId || clients.length === 0) { setClientCards([]); return; }
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    Promise.all(
      clients.slice(0, 8).map(async (client) => {
        const [tasks, entries, invoices] = await Promise.all([
          window.api.tasks.list({ clientId: client.id }),
          window.api.tracker.entries({ clientId: client.id }),
          window.api.invoices.list({ clientId: client.id }),
        ]);
        const openTasks = tasks.filter((t) => t.status !== 'done').length;
        const trackedMsMonth = entries
          .filter((e) => e.started_at >= monthStart.getTime())
          .reduce((s, e) => s + (e.duration_ms || (e as any).accumulated_ms || 0), 0);
        const lastActivity = entries.length ? entries[0].started_at : null;
        const outstandingAmt = invoices
          .filter((i) => i.status === 'sent' || i.status === 'overdue')
          .reduce((s, i) => s + (i.total || 0), 0);
        const healthScore = calcHealthScore(openTasks, lastActivity, outstandingAmt, trackedMsMonth);
        return { client, openTasks, trackedMsMonth, lastActivity, outstandingAmt, healthScore };
      })
    ).then(setClientCards);
  }, [clients, activeClientId]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {activeClient ? activeClient.name : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeClient ? activeClient.company || 'Client overview' : `Welcome back to ${agency.name}`}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle size={14} />
              <span>{overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Alert banners */}
      {(overdueInvoices.length > 0 || contractAlerts.length > 0) && (
        <div className="space-y-2">
          {overdueInvoices.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <FileText size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-amber-800 text-sm">
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
                </span>
                <span className="text-amber-700 text-sm ml-2">
                  — {overdueInvoices.slice(0, 3).map((i) => `${i.client_name || 'Unknown'} (${agency.currency}${Math.round(i.total)})`).join(', ')}
                  {overdueInvoices.length > 3 ? ` +${overdueInvoices.length - 3} more` : ''}
                </span>
              </div>
            </div>
          )}
          {contractAlerts.map((c: any) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <CalendarClock size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <span className="text-sm text-blue-800">
                <strong>{c.name}</strong> contract expires in <strong>{c.daysLeft} day{c.daysLeft !== 1 ? 's' : ''}</strong>
                {c.auto_renew ? ' — auto-renew is on' : ' — action required'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Stat icon={Users} label="Clients" value={stats.totalClients} color="bg-blue-500" />
        <Stat icon={ListTodo} label="Open Tasks" value={stats.openTasks} color="bg-amber-500" />
        <Stat icon={CheckCircle2} label="Completed" value={stats.doneTasks} color="bg-emerald-500" />
        <Stat icon={Clock} label="Time Tracked" value={formatDuration(stats.trackedMs)} color="bg-violet-500" />
        <Stat icon={Receipt} label="Paid Revenue" value={`${agency.currency} ${revenue.paid.toLocaleString()}`} color="bg-emerald-600" />
        <Stat icon={TrendingUp} label="Outstanding" value={`${agency.currency} ${revenue.outstanding.toLocaleString()}`} color="bg-orange-500" />
      </div>

      {clientCards.length > 0 && (
        <section>
          <h2 className="font-semibold text-slate-700 mb-3">Client status</h2>
          <div className="grid grid-cols-2 gap-3">
            {clientCards.map(({ client, openTasks, trackedMsMonth, lastActivity, outstandingAmt, healthScore }) => {
              const hc = healthColor(healthScore);
              return (
                <div key={client.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: client.color }} />
                    <div className="font-semibold text-sm truncate flex-1">{client.name}</div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                      {client.stage}
                    </span>
                  </div>
                  {/* Health score bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Client health</span>
                      <span className={`font-semibold ${hc.text}`}>{hc.label} · {healthScore}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${hc.bar} transition-all`} style={{ width: `${healthScore}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-lg font-bold">{openTasks}</div>
                      <div className="text-[10px] text-slate-500">Open tasks</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-violet-600">{formatDuration(trackedMsMonth)}</div>
                      <div className="text-[10px] text-slate-500">This month</div>
                    </div>
                    <div className={`rounded-lg p-2 ${outstandingAmt > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                      <div className={`text-lg font-bold ${outstandingAmt > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {outstandingAmt > 0 ? `${agency.currency}${Math.round(outstandingAmt).toLocaleString()}` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">Outstanding</div>
                    </div>
                  </div>
                  {lastActivity && (
                    <div className="text-[11px] text-slate-400">Last activity: {formatDateTime(lastActivity)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Recent tasks">
          {recentTasks.length === 0 ? <Empty>No tasks yet.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {recentTasks.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-500' : t.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.due_date && t.due_date < Date.now() && t.status !== 'done' && (
                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  )}
                  {t.client_name && <span className="text-xs text-slate-400 truncate max-w-[5rem]">{t.client_name}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent time entries">
          {recentEntries.length === 0 ? <Empty>No entries yet.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {recentEntries.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate">{e.description || (e as any).task_title || 'Untitled'}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {(e as any).status === 'done' ? formatDuration(e.duration_ms) : (e as any).status === 'running' ? '▶' : '⏸'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {(e as any).client_name && `${(e as any).client_name} · `}
                    {(e as any).date || formatDateTime(e.started_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent invoices">
        {recentInvoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {recentInvoices.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-slate-400 w-28 truncate">{i.number}</span>
                <span className="flex-1 truncate">{i.client_name || '—'}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  i.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  i.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  i.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>{i.status}</span>
                <span className="font-mono text-xs w-24 text-right text-slate-600">
                  {agency.currency} {(i.total || 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 py-4 text-center">{children}</div>;
}
