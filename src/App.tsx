import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ClientSwitcher } from './components/ClientSwitcher';
import { TrackerBadge } from './components/TrackerBadge';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ClientProvider } from './state/ClientContext';
import { AgencyProvider, useAgency } from './state/AgencyContext';
import { ToastProvider, useToast, type ToastType } from './state/ToastContext';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Pipeline from './pages/Pipeline';
import Tasks from './pages/Tasks';
import Tracker from './pages/Tracker';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Marketing from './pages/Marketing';
import AIWriter from './pages/AIWriter';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Expenses from './pages/Expenses';
import Proposals from './pages/Proposals';

/** Restores persisted dark mode preference on first load */
function DarkModeBoot() {
  useEffect(() => {
    window.api.settings.get('ui.darkMode').then((v: string | null) => {
      if (v === 'true') document.documentElement.classList.add('dark');
    });
  }, []);
  return null;
}

/** Subscribes to IPC events and bridges them to the toast system */
function NotificationBridge() {
  const { toast } = useToast();
  useEffect(() => {
    const offNotify = window.api.app.onNotify((p) => {
      toast(p.type as ToastType, p.title, p.description);
    });
    const offShot = window.api.tracker.onScreenshot((p: any) => {
      const desc = p.client_name ? `Client: ${p.client_name}` : 'Screenshot saved to tracker entry.';
      toast('screenshot', 'Screenshot captured', desc);
    });
    return () => { offNotify(); offShot(); };
  }, [toast]);
  return null;
}

/** Shows due/overdue task alerts on first load */
function DueAlertsBridge() {
  const { toast } = useToast();
  useEffect(() => {
    window.api.tasks.dueAlerts().then((alerts: any[]) => {
      const overdue = alerts.filter((a) => a.isOverdue);
      const dueToday = alerts.filter((a) => a.isDueToday);
      if (overdue.length) {
        toast('error', `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
          overdue.slice(0, 3).map((a: any) => a.title).join(', ') + (overdue.length > 3 ? '…' : ''));
      }
      if (dueToday.length) {
        toast('info', `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`,
          dueToday.slice(0, 3).map((a: any) => a.title).join(', ') + (dueToday.length > 3 ? '…' : ''));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire once on mount
  return null;
}

/** Global keyboard shortcuts */
function KeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ctrl+Shift+N — new task (navigate to tasks)
      if (e.shiftKey && e.key === 'N') { e.preventDefault(); navigate('/tasks'); return; }
      // Ctrl+Shift+T — go to tracker
      if (e.shiftKey && e.key === 'T') { e.preventDefault(); navigate('/tracker'); return; }
      // Ctrl+Shift+I — go to invoices
      if (e.shiftKey && e.key === 'I') { e.preventDefault(); navigate('/invoices'); return; }
      // Ctrl+P — pause/resume tracker
      if (!e.shiftKey && e.key === 'p') {
        e.preventDefault();
        const s = await window.api.tracker.status();
        if (s.status === 'running') await window.api.tracker.pause();
        else if (s.status === 'paused') await window.api.tracker.resume();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  return null;
}

function Shell() {
  const { agency } = useAgency();
  return (
    <div className="flex h-full" style={{ ['--brand' as any]: agency.primary_color }}>
      <Sidebar agencyName={agency.name} logoDataUrl={agency.logo_data_url} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
          <ClientSwitcher />
          <TrackerBadge />
        </header>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/clients" element={<ErrorBoundary><Clients /></ErrorBoundary>} />
            <Route path="/pipeline" element={<ErrorBoundary><Pipeline /></ErrorBoundary>} />
            <Route path="/tasks" element={<ErrorBoundary><Tasks /></ErrorBoundary>} />
            <Route path="/tracker" element={<ErrorBoundary><Tracker /></ErrorBoundary>} />
            <Route path="/invoices" element={<ErrorBoundary><Invoices /></ErrorBoundary>} />
            <Route path="/proposals" element={<ErrorBoundary><Proposals /></ErrorBoundary>} />
            <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
            <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="/calendar" element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
            <Route path="/ai" element={<ErrorBoundary><AIWriter /></ErrorBoundary>} />
            <Route path="/marketing" element={<ErrorBoundary><Marketing /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
      <DarkModeBoot />
      <NotificationBridge />
      <DueAlertsBridge />
      <KeyboardShortcuts />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AgencyProvider>
        <ClientProvider>
          <Shell />
        </ClientProvider>
      </AgencyProvider>
    </ToastProvider>
  );
}
