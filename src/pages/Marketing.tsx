import { useEffect, useState, useRef } from 'react';
import { Megaphone, Play, ExternalLink, FolderSearch, Loader2, RefreshCw } from 'lucide-react';
import type { SeoStatus } from '../types';

export default function Marketing() {
  const [status, setStatus] = useState<SeoStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embedKey, setEmbedKey] = useState(0);
  const webviewRef = useRef<any>(null);

  const refresh = async () => {
    const s = await window.api.seo.status();
    setStatus(s);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const launch = async () => {
    setLaunching(true);
    setError(null);
    const r = await window.api.seo.launch();
    setLaunching(false);
    if (!r.ok) setError(r.error || 'Failed to launch');
    else setEmbedKey((k) => k + 1);
    refresh();
  };

  const setPath = async () => {
    const r = await window.api.seo.setPath();
    if (r.ok) refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={20} className="text-brand-600" />
          <div>
            <h1 className="text-lg font-bold">Marketing — A1 SEO Dynamics</h1>
            <p className="text-xs text-slate-500">Email marketing & automation, embedded from your existing app.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status?.running ? (
            <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-medium">● Running</span>
          ) : (
            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium">○ Stopped</span>
          )}
          {status?.running && (
            <>
              <button
                onClick={() => setEmbedKey((k) => k + 1)}
                className="p-1.5 rounded hover:bg-slate-100"
                title="Reload embedded view"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => window.api.seo.openInBrowser()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-white border border-slate-200 hover:bg-slate-50"
              >
                <ExternalLink size={12} /> Open in browser
              </button>
            </>
          )}
          {!status?.running && status?.installed && (
            <button
              onClick={launch}
              disabled={launching}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {launching ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {launching ? 'Starting…' : 'Launch'}
            </button>
          )}
          <button
            onClick={setPath}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-white border border-slate-200 hover:bg-slate-50"
            title="Locate folder"
          >
            <FolderSearch size={12} /> Locate
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-50">
        {!status?.installed && (
          <div className="p-6 max-w-2xl">
            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm">
              <div className="font-semibold text-amber-900 mb-1">A1 SEO Dynamics not found</div>
              <div className="text-amber-800">
                Expected at: <code className="text-xs bg-white px-1 py-0.5 rounded">{status?.path}</code>
              </div>
              <div className="text-amber-800 mt-2">
                Use <strong>Locate</strong> above to point to the folder containing <code>start_app.bat</code>.
              </div>
            </div>
          </div>
        )}

        {status?.installed && !status?.running && (
          <div className="p-6 max-w-xl">
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
              <Megaphone size={40} className="text-brand-500 mx-auto mb-3" />
              <h2 className="font-semibold text-lg">A1 SEO Dynamics is installed</h2>
              <p className="text-sm text-slate-500 mt-1 mb-4">
                Click Launch to start the marketing app. It will open in a server window and embed here.
              </p>
              {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
              <button
                onClick={launch}
                disabled={launching}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50"
              >
                {launching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {launching ? 'Starting server…' : 'Launch SEO Dynamics'}
              </button>
              <div className="text-xs text-slate-500 mt-4">
                First launch can take up to a minute (installs Python deps, builds frontend).
              </div>
            </div>
          </div>
        )}

        {status?.running && (
          <webview
            key={embedKey}
            ref={webviewRef as any}
            src={status.url}
            style={{ width: '100%', height: '100%', display: 'inline-flex' }}
            allowpopups={'true' as any}
          />
        )}
      </div>
    </div>
  );
}
