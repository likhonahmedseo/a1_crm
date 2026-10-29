import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, ListTodo, Timer, Settings as SettingsIcon,
  Kanban, FileText, BarChart3, Megaphone, Sparkles, CalendarDays,
  Receipt, FileSignature,
} from 'lucide-react';
import { cn } from '../lib/utils';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/pipeline', label: 'Sales Pipeline', icon: Kanban },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/tracker', label: 'Time Tracker', icon: Timer },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/proposals', label: 'Proposals', icon: FileSignature },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/calendar', label: 'Content Calendar', icon: CalendarDays },
  { to: '/ai', label: 'AI Writer', icon: Sparkles },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar({ agencyName, logoDataUrl }: { agencyName?: string; logoDataUrl?: string }) {
  return (
    <aside className="w-60 bg-slate-900 text-slate-200 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
        {logoDataUrl ? (
          <img src={logoDataUrl} alt="logo" className="w-9 h-9 object-contain rounded bg-white/10 p-1" />
        ) : (
          <div className="w-9 h-9 rounded bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
            A1
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">A1 CRM</div>
          <div className="text-[10px] text-slate-400 truncate">{agencyName || 'A1 Technovation'}</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition',
                isActive
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 text-[11px] text-slate-500 border-t border-slate-800">
        v0.3.0
      </div>
    </aside>
  );
}
