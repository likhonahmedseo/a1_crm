import { X, CheckCircle, AlertCircle, Info, Camera } from 'lucide-react';
import { useToast, type ToastItem } from '../state/ToastContext';

const icons = {
  success: <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
  error: <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />,
  info: <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />,
  screenshot: <Camera size={16} className="text-violet-500 shrink-0 mt-0.5" />,
};

const borders = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  screenshot: 'border-l-violet-500',
};

function ToastCard({ t }: { t: ToastItem }) {
  const { dismiss } = useToast();
  return (
    <div
      className={`flex items-start gap-3 bg-white shadow-lg rounded-lg border border-slate-200 border-l-4 ${borders[t.type]} px-4 py-3 w-80 animate-slide-in`}
    >
      {icons[t.type]}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 leading-snug">{t.title}</div>
        {t.description && (
          <div className="text-xs text-slate-500 mt-0.5 leading-snug">{t.description}</div>
        )}
      </div>
      <button
        onClick={() => dismiss(t.id)}
        className="text-slate-400 hover:text-slate-600 shrink-0 -mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard t={t} />
        </div>
      ))}
    </div>
  );
}
