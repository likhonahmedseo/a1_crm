import { useEffect, useState } from 'react';
import {
  FolderOpen, Info, Upload, Trash2, Download, Save, Database,
  Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { useAgency } from '../state/AgencyContext';
import { useToast } from '../state/ToastContext';
import type { AgencyInfo } from '../types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'CAD', 'AUD', 'AED', 'SGD'];

export default function Settings() {
  const { agency, refresh } = useAgency();
  const { toast } = useToast();
  const [draft, setDraft] = useState<AgencyInfo>(agency);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(agency);
  }, [agency]);

  const update = (patch: Partial<AgencyInfo>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    try {
      await window.api.agency.set({
        'agency.name': draft.name,
        'agency.address': draft.address,
        'agency.email': draft.email,
        'agency.phone': draft.phone,
        'agency.website': draft.website,
        'agency.currency': draft.currency,
        'agency.primary_color': draft.primary_color,
        'agency.invoice_footer': draft.invoice_footer,
        'agency.invoice_prefix': draft.invoice_prefix,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      toast('success', 'Settings saved');
    } catch {
      toast('error', 'Failed to save settings');
    }
  };

  const uploadLogo = async () => {
    const r = await window.api.agency.uploadLogo();
    if (r.ok) await refresh();
  };

  const clearLogo = async () => {
    if (!confirm('Remove logo?')) return;
    await window.api.agency.clearLogo();
    await refresh();
  };

  const exportBackup = async () => {
    const r = await window.api.backup.export();
    if (r.ok) toast('success', 'Backup saved', r.filePath ? `Saved to ${r.filePath}` : undefined);
    else toast('info', 'Backup cancelled');
  };

  const importBackup = async () => {
    const r = await window.api.backup.import();
    if (r.ok) {
      location.reload();
    } else if (r.error) {
      toast('error', 'Restore failed', r.error);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* White-label / Agency */}
      <Section title="Agency profile (white-label)">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 border border-slate-200 rounded flex items-center justify-center bg-slate-50 overflow-hidden">
              {agency.logo_data_url ? (
                <img src={agency.logo_data_url} alt="logo" className="max-w-full max-h-full" />
              ) : (
                <span className="text-xs text-slate-400">No logo</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <button onClick={uploadLogo} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 self-start">
                <Upload size={14} /> Upload logo
              </button>
              {agency.logo_data_url && (
                <button onClick={clearLogo} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50 self-start">
                  <Trash2 size={14} /> Remove logo
                </button>
              )}
              <div className="text-xs text-slate-500">PNG, JPG, or SVG. Used in sidebar and on invoices.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Agency name">
              <input value={draft.name} onChange={(e) => update({ name: e.target.value })} className="w-full input" />
            </Field>
            <Field label="Email">
              <input value={draft.email} onChange={(e) => update({ email: e.target.value })} className="w-full input" />
            </Field>
            <Field label="Phone">
              <input value={draft.phone} onChange={(e) => update({ phone: e.target.value })} className="w-full input" />
            </Field>
            <Field label="Website">
              <input value={draft.website} onChange={(e) => update({ website: e.target.value })} className="w-full input" />
            </Field>
            <Field label="Currency">
              <select value={draft.currency} onChange={(e) => update({ currency: e.target.value })} className="w-full input">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Brand color">
              <input
                type="color"
                value={draft.primary_color}
                onChange={(e) => update({ primary_color: e.target.value })}
                className="h-9 w-full rounded border border-slate-200"
              />
            </Field>
            <Field label="Invoice prefix">
              <input
                value={draft.invoice_prefix}
                onChange={(e) => update({ invoice_prefix: e.target.value })}
                className="w-full input"
                placeholder="INV-"
              />
            </Field>
            <div />
            <div className="col-span-2">
              <Field label="Address">
                <textarea
                  rows={2}
                  value={draft.address}
                  onChange={(e) => update({ address: e.target.value })}
                  className="w-full input"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Invoice footer">
                <input
                  value={draft.invoice_footer}
                  onChange={(e) => update({ invoice_footer: e.target.value })}
                  className="w-full input"
                  placeholder="Thank you for your business!"
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3">
            {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
            <button onClick={save} className="flex items-center gap-1 px-4 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600">
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      </Section>

      {/* App behavior */}
      <AppBehaviorSection />

      {/* AI Content Writer */}
      <AISection />

      {/* Time tracker */}
      <Section title="Time tracker">
        <Row label="Screenshot interval">
          <span className="text-sm text-slate-700">Random every 5–10 minutes</span>
        </Row>
        <Row label="Storage location">
          <button
            onClick={() => window.api.tracker.openScreenshotsDir()}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
          >
            <FolderOpen size={14} /> Open screenshots folder
          </button>
        </Row>
      </Section>

      {/* Backup */}
      <Section title="Backup & data">
        <Row label="Export everything">
          <button
            onClick={exportBackup}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            <Download size={14} /> Export backup (JSON)
          </button>
        </Row>
        <Row label="Restore from backup">
          <button
            onClick={importBackup}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded hover:bg-slate-50"
          >
            <Upload size={14} /> Import backup
          </button>
        </Row>
        <Row label="Database location">
          <button
            onClick={() => window.api.backup.openDataFolder()}
            className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
          >
            <Database size={14} /> Open data folder
          </button>
        </Row>
      </Section>

      <Section title="About">
        <div className="p-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded">
            <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-700">
              <div className="font-semibold">A1 CRM v0.3.0</div>
              <div className="text-slate-600">By A1 Technovation</div>
              <div className="text-slate-600 mt-1">
                Offline-first agency CRM. All data stored locally. No cloud sync, no telemetry.
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Per-provider model lists ──────────────────────────────────────────────────
const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast & cheap' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 — balanced' },
  { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7 — best quality' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini',   label: 'GPT-4o mini — fast & cheap' },
  { id: 'gpt-4o',        label: 'GPT-4o — balanced' },
  { id: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo — legacy' },
];

// Popular Ollama models grouped by family — these can be pulled with `ollama pull <id>`
const OLLAMA_MODEL_CATALOG: { group: string; cloud?: boolean; models: { id: string; label: string; size: string; note?: string }[] }[] = [
  {
    group: '☁️ Cloud models (via Ollama)',
    cloud: true,
    models: [
      { id: 'minimax-m2.7:cloud',       label: 'MiniMax M2.7',       size: 'Cloud', note: 'MiniMax — strong multilingual & long-context' },
      { id: 'gemma4:31b-cloud',         label: 'Gemma 4 31B',        size: 'Cloud', note: 'Google — latest Gemma, multimodal' },
      { id: 'qwen3.5:397b-cloud',       label: 'Qwen 3.5 397B',      size: 'Cloud', note: 'Alibaba — massive MoE model' },
      { id: 'gpt-oss:120b-cloud',       label: 'GPT OSS 120B',       size: 'Cloud', note: 'OpenAI open-source 120B variant' },
      { id: 'gpt-oss:20b-cloud',        label: 'GPT OSS 20B',        size: 'Cloud', note: 'OpenAI open-source 20B — faster' },
      { id: 'deepseek-v3.1:671b-cloud', label: 'DeepSeek V3.1 671B', size: 'Cloud', note: 'DeepSeek — latest flagship, top-tier' },
    ],
  },
  {
    group: 'Llama (Meta)',
    models: [
      { id: 'llama3.2',       label: 'Llama 3.2',       size: '3B',   note: 'Fast, great for most tasks' },
      { id: 'llama3.2:1b',    label: 'Llama 3.2 1B',    size: '1B',   note: 'Ultra-fast, minimal RAM' },
      { id: 'llama3.1',       label: 'Llama 3.1',       size: '8B',   note: 'Strong reasoning' },
      { id: 'llama3.1:70b',   label: 'Llama 3.1 70B',   size: '70B',  note: 'Best quality, needs 40GB+ RAM' },
      { id: 'llama3.3',       label: 'Llama 3.3',       size: '70B',  note: 'Latest Llama, top-tier' },
      { id: 'llama2',         label: 'Llama 2',         size: '7B',   note: 'Legacy, widely tested' },
    ],
  },
  {
    group: 'Mistral / Mixtral',
    models: [
      { id: 'mistral',        label: 'Mistral 7B',      size: '7B',   note: 'Fast, excellent quality' },
      { id: 'mistral-nemo',   label: 'Mistral Nemo',    size: '12B',  note: 'Longer context (128k)' },
      { id: 'mixtral',        label: 'Mixtral 8x7B',    size: '47B',  note: 'MoE — high quality' },
      { id: 'mixtral:8x22b',  label: 'Mixtral 8x22B',   size: '141B', note: 'Best Mixtral, needs 90GB+' },
    ],
  },
  {
    group: 'Gemma (Google)',
    models: [
      { id: 'gemma3:1b',      label: 'Gemma 3 1B',      size: '1B',   note: 'Tiny but capable' },
      { id: 'gemma3',         label: 'Gemma 3 4B',      size: '4B',   note: 'Great for low-end hardware' },
      { id: 'gemma3:12b',     label: 'Gemma 3 12B',     size: '12B',  note: 'Balanced' },
      { id: 'gemma3:27b',     label: 'Gemma 3 27B',     size: '27B',  note: 'Top Gemma quality' },
      { id: 'gemma2',         label: 'Gemma 2 9B',      size: '9B',   note: 'Previous gen, solid' },
    ],
  },
  {
    group: 'Phi (Microsoft)',
    models: [
      { id: 'phi4-mini',      label: 'Phi-4 Mini',      size: '3.8B', note: 'Small but powerful' },
      { id: 'phi4',           label: 'Phi-4',           size: '14B',  note: 'Best Phi, strong reasoning' },
      { id: 'phi3',           label: 'Phi-3 Medium',    size: '14B',  note: 'Great coding + reasoning' },
      { id: 'phi3:mini',      label: 'Phi-3 Mini',      size: '3.8B', note: 'Fast on low RAM' },
    ],
  },
  {
    group: 'Qwen (Alibaba)',
    models: [
      { id: 'qwen2.5:0.5b',   label: 'Qwen 2.5 0.5B',  size: '0.5B', note: 'Smallest, very fast' },
      { id: 'qwen2.5:1.5b',   label: 'Qwen 2.5 1.5B',  size: '1.5B', note: 'Tiny & fast' },
      { id: 'qwen2.5',        label: 'Qwen 2.5 7B',     size: '7B',   note: 'Excellent multilingual' },
      { id: 'qwen2.5:14b',    label: 'Qwen 2.5 14B',    size: '14B',  note: 'Strong at coding & math' },
      { id: 'qwen2.5:32b',    label: 'Qwen 2.5 32B',    size: '32B',  note: 'Near GPT-4 level' },
      { id: 'qwen2.5:72b',    label: 'Qwen 2.5 72B',    size: '72B',  note: 'Top Qwen — 48GB+ RAM' },
    ],
  },
  {
    group: 'DeepSeek',
    models: [
      { id: 'deepseek-r1:1.5b', label: 'DeepSeek R1 1.5B', size: '1.5B', note: 'Reasoning model, tiny' },
      { id: 'deepseek-r1:7b',   label: 'DeepSeek R1 7B',   size: '7B',   note: 'Strong reasoning' },
      { id: 'deepseek-r1:14b',  label: 'DeepSeek R1 14B',  size: '14B',  note: 'Very capable' },
      { id: 'deepseek-r1:32b',  label: 'DeepSeek R1 32B',  size: '32B',  note: 'High quality reasoning' },
      { id: 'deepseek-r1:70b',  label: 'DeepSeek R1 70B',  size: '70B',  note: 'Best DeepSeek, 48GB+ RAM' },
      { id: 'deepseek-v3',      label: 'DeepSeek V3',      size: '671B', note: 'Requires high-end server' },
    ],
  },
  {
    group: 'Code-optimised',
    models: [
      { id: 'codellama',        label: 'Code Llama 7B',    size: '7B',   note: 'Code generation' },
      { id: 'codellama:13b',    label: 'Code Llama 13B',   size: '13B',  note: 'Better code quality' },
      { id: 'codegemma',        label: 'CodeGemma 7B',     size: '7B',   note: 'Google code model' },
      { id: 'qwen2.5-coder',    label: 'Qwen 2.5 Coder 7B', size: '7B', note: 'Top open-source coder' },
      { id: 'qwen2.5-coder:14b', label: 'Qwen 2.5 Coder 14B', size: '14B', note: 'Very strong coding' },
    ],
  },
  {
    group: 'Other notable',
    models: [
      { id: 'command-r',       label: 'Command R',         size: '35B',  note: 'Cohere — great for RAG' },
      { id: 'command-r-plus',  label: 'Command R+',        size: '104B', note: 'Best Cohere, needs 64GB+' },
      { id: 'solar',           label: 'SOLAR 10.7B',       size: '10.7B', note: 'Upstage — good quality' },
      { id: 'vicuna',          label: 'Vicuna 7B',         size: '7B',   note: 'ChatGPT-style fine-tune' },
      { id: 'openchat',        label: 'OpenChat 7B',       size: '7B',   note: 'High-quality chat' },
    ],
  },
];

type ProviderTab = 'anthropic' | 'openai' | 'ollama';

const PROVIDER_TABS: { id: ProviderTab; label: string; badge: string; color: string }[] = [
  { id: 'anthropic', label: 'Claude',  badge: 'Anthropic', color: 'bg-violet-500' },
  { id: 'openai',    label: 'OpenAI',  badge: 'OpenAI',    color: 'bg-emerald-600' },
  { id: 'ollama',    label: 'Ollama',  badge: 'Local',     color: 'bg-amber-500' },
];

function AppBehaviorSection() {
  const { toast } = useToast();
  const [runInBackground, setRunInBackground] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    window.api.app.getRunInBackground().then(setRunInBackground);
    // Restore persisted dark-mode preference
    window.api.settings.get('ui.darkMode').then((v: string | null) => {
      if (v === 'true') {
        document.documentElement.classList.add('dark');
        setDarkMode(true);
      }
    });
  }, []);

  const toggle = async () => {
    const next = !runInBackground;
    await window.api.app.setRunInBackground(next);
    setRunInBackground(next);
    toast(
      'success',
      next ? 'Background mode enabled' : 'Background mode disabled',
      next
        ? 'Closing the window will minimize to the system tray instead of quitting.'
        : 'Closing the window will quit the app.'
    );
  };

  const toggleDark = async () => {
    const next = !darkMode;
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    setDarkMode(next);
    await window.api.settings.set('ui.darkMode', String(next));
    toast('success', next ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? 'bg-brand-500' : 'bg-slate-200'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <Section title="App behavior">
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700">Run in background</div>
          <div className="text-xs text-slate-500 mt-0.5 max-w-sm">
            When enabled, closing the window minimizes A1 CRM to the system tray instead of quitting.
            The time tracker, midnight reset, and screenshot capture keep running.
            Right-click the tray icon to fully quit.
          </div>
        </div>
        <Toggle on={runInBackground} onToggle={toggle} />
      </div>
      {runInBackground && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-800">
            <Info size={13} className="shrink-0 mt-0.5" />
            <div>
              <strong>Tray icon colors:</strong> 🔵 Blue = idle · 🟢 Green = tracking · 🟡 Amber = paused.
              Right-click the tray icon to pause, resume, or stop the tracker without opening the app.
            </div>
          </div>
        </div>
      )}
      <div className="px-4 py-3 border-t border-slate-100 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700">Dark mode</div>
          <div className="text-xs text-slate-500 mt-0.5">Switch the interface to a dark color scheme. Preference is saved automatically.</div>
        </div>
        <Toggle on={darkMode} onToggle={toggleDark} />
      </div>
    </Section>
  );
}

function AISection() {
  const { toast } = useToast();

  // Global state from backend
  const [status, setStatus] = useState<any>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderTab>('anthropic');
  const [tab, setTab] = useState<ProviderTab>('anthropic');

  // Per-provider form state
  const [anthropicKey, setAnthropicKey]   = useState('');
  const [openaiKey, setOpenaiKey]         = useState('');
  const [ollamaUrl, setOllamaUrl]         = useState('http://localhost:11434');
  const [anthropicModel, setAnthropicModel] = useState('claude-haiku-4-5-20251001');
  const [openaiModel, setOpenaiModel]     = useState('gpt-4o-mini');
  const [ollamaModel, setOllamaModel]     = useState('llama3.2');
  const [ollamaModels, setOllamaModels]   = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const [showKey, setShowKey]     = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving]       = useState(false);

  const refresh = async () => {
    const s = await window.api.ai.status();
    setStatus(s);
    setActiveProvider(s.provider as ProviderTab);
    setTab(s.provider as ProviderTab);
    setAnthropicModel(s.anthropicModel);
    setOpenaiModel(s.openaiModel);
    setOllamaModel(s.ollamaModel);
    setOllamaUrl(s.ollamaUrl || 'http://localhost:11434');
  };

  useEffect(() => { refresh(); }, []);

  // Switch active provider
  const switchProvider = async (p: ProviderTab) => {
    await window.api.ai.setProvider(p);
    setActiveProvider(p);
    toast('success', `Switched to ${PROVIDER_TABS.find(t => t.id === p)?.label}`);
    await refresh();
  };

  // Save API key / URL
  const saveKey = async (provider: ProviderTab, value: string) => {
    if (!value.trim()) return;
    setSaving(true);
    await window.api.ai.setKey(provider, value.trim());
    if (provider === 'anthropic') setAnthropicKey('');
    if (provider === 'openai')    setOpenaiKey('');
    if (provider === 'ollama')    {}  // URL kept for display
    toast('success', 'Saved');
    await refresh();
    setSaving(false);
  };

  // Remove key
  const clearKey = async (provider: ProviderTab) => {
    if (!confirm('Remove saved API key?')) return;
    await window.api.ai.clearKey(provider);
    setTestResult(null);
    await refresh();
    toast('info', 'Key removed');
  };

  // Save model selection
  const saveModel = async (provider: ProviderTab, model: string) => {
    await window.api.ai.setModel(provider, model);
    if (provider === 'anthropic') setAnthropicModel(model);
    if (provider === 'openai')    setOpenaiModel(model);
    if (provider === 'ollama')    setOllamaModel(model);
  };

  // Test connectivity
  const testConnection = async (provider: ProviderTab) => {
    setTesting(true);
    setTestResult(null);
    const keyToTest =
      provider === 'anthropic' ? (anthropicKey.trim() || '__stored__') :
      provider === 'openai'    ? (openaiKey.trim()    || '__stored__') :
      ollamaUrl.trim();
    const r = await window.api.ai.testKey(provider, keyToTest === '__stored__' ? '' : keyToTest);
    setTestResult({ ok: r.ok, msg: r.ok ? `✓ Connected${r.response ? ` — "${r.response}"` : ''}` : r.error || 'Failed' });
    setTesting(false);
  };

  // Fetch Ollama models from running server
  const fetchOllamaModels = async () => {
    setOllamaLoading(true);
    const r = await window.api.ai.listOllamaModels(ollamaUrl.trim());
    if (r.ok && r.models.length) {
      setOllamaModels(r.models);
      toast('success', `Found ${r.models.length} models`);
    } else {
      toast('error', 'Could not fetch models', r.error);
    }
    setOllamaLoading(false);
  };

  if (!status) return <div className="p-4 text-sm text-slate-400">Loading…</div>;

  return (
    <Section title="AI Content Writer">
      <div className="p-4 space-y-4">

        {/* Active provider selector */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Active provider</div>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDER_TABS.map((p) => {
              const isActive = activeProvider === p.id;
              const isConfigured =
                p.id === 'anthropic' ? status.anthropicConfigured :
                p.id === 'openai'    ? status.openaiConfigured :
                true; // Ollama always "configured"
              return (
                <button
                  key={p.id}
                  onClick={() => switchProvider(p.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    isActive
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${p.color}`}>
                    {p.label[0]}
                  </div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-[10px] text-slate-400">{p.badge}</div>
                  {isConfigured && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" title="Configured" />
                  )}
                  {isActive && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold text-brand-600 uppercase tracking-wider">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {PROVIDER_TABS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setTab(p.id); setTestResult(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === p.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Anthropic tab ── */}
        {tab === 'anthropic' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-800">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              API keys are stored locally on this machine only — never transmitted anywhere except{' '}
              <code className="bg-violet-100 px-1 rounded">api.anthropic.com</code>.
            </div>

            <Field label={status.anthropicConfigured ? 'API key (saved — paste to replace)' : 'API key'}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder={status.anthropicConfigured ? '•••• paste new key to replace' : 'sk-ant-api03-…'}
                    className="w-full input pr-9 font-mono text-xs"
                    autoComplete="off" spellCheck={false}
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100">
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button onClick={() => saveKey('anthropic', anthropicKey)} disabled={!anthropicKey.trim() || saving}
                  className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50">
                  Save
                </button>
              </div>
            </Field>

            <Field label="Model">
              <select value={anthropicModel} onChange={(e) => saveModel('anthropic', e.target.value)} className="w-full input">
                {ANTHROPIC_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>

            <ProviderActions
              onTest={() => testConnection('anthropic')}
              onClear={status.anthropicConfigured ? () => clearKey('anthropic') : undefined}
              testing={testing} testResult={testResult}
              canTest={!!(anthropicKey.trim() || status.anthropicConfigured)}
            />
          </div>
        )}

        {/* ── OpenAI tab ── */}
        {tab === 'openai' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              API keys are stored locally only — sent exclusively to{' '}
              <code className="bg-emerald-100 px-1 rounded">api.openai.com</code>.
              Get a key at <span className="underline">platform.openai.com</span>.
            </div>

            <Field label={status.openaiConfigured ? 'API key (saved — paste to replace)' : 'API key'}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={status.openaiConfigured ? '•••• paste new key to replace' : 'sk-proj-…'}
                    className="w-full input pr-9 font-mono text-xs"
                    autoComplete="off" spellCheck={false}
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100">
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button onClick={() => saveKey('openai', openaiKey)} disabled={!openaiKey.trim() || saving}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  Save
                </button>
              </div>
            </Field>

            <Field label="Model">
              <select value={openaiModel} onChange={(e) => saveModel('openai', e.target.value)} className="w-full input">
                {OPENAI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>

            <ProviderActions
              onTest={() => testConnection('openai')}
              onClear={status.openaiConfigured ? () => clearKey('openai') : undefined}
              testing={testing} testResult={testResult}
              canTest={!!(openaiKey.trim() || status.openaiConfigured)}
            />
          </div>
        )}

        {/* ── Ollama tab ── */}
        {tab === 'ollama' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Info size={13} className="shrink-0 mt-0.5" />
              <div>
                Ollama runs <strong>100% locally</strong> — no API key, no data leaves your machine.{' '}
                Install from <span className="underline font-medium">ollama.com</span>, then run{' '}
                <code className="bg-amber-100 px-1 rounded">ollama serve</code>.
                Pull any model below with <code className="bg-amber-100 px-1 rounded">ollama pull &lt;model&gt;</code>.
              </div>
            </div>

            {/* Server URL */}
            <Field label="Ollama server URL">
              <div className="flex gap-2">
                <input
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 input font-mono text-xs"
                />
                <button onClick={() => saveKey('ollama', ollamaUrl)} disabled={saving}
                  className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap">
                  Save URL
                </button>
              </div>
            </Field>

            {/* Active model display + fetch from server */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-600 mb-1">Active model</div>
                <div className="flex gap-2">
                  <input
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    onBlur={() => saveModel('ollama', ollamaModel)}
                    placeholder="llama3.2"
                    className="flex-1 input font-mono text-sm"
                  />
                  <button
                    onClick={fetchOllamaModels}
                    disabled={ollamaLoading}
                    title="Load models installed on your Ollama server"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {ollamaLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Fetch installed
                  </button>
                </div>
                {ollamaModels.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[11px] text-slate-400 self-center mr-1">Installed:</span>
                    {ollamaModels.map((m) => (
                      <button
                        key={m}
                        onClick={() => { setOllamaModel(m); saveModel('ollama', m); }}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                          ollamaModel === m
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Model catalog */}
            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">
                Available models — click any to select, then run{' '}
                <code className="bg-slate-100 px-1 rounded">ollama pull &lt;model&gt;</code> to install it
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {OLLAMA_MODEL_CATALOG.map((group) => (
                  <div key={group.group}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
                      group.cloud ? 'text-blue-500' : 'text-slate-400'
                    }`}>
                      {group.group}
                      {group.cloud && (
                        <span className="normal-case font-normal text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                          No local RAM needed
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.models.map((m) => {
                        const isSelected = ollamaModel === m.id;
                        const isCloud = group.cloud;
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setOllamaModel(m.id); saveModel('ollama', m.id); }}
                            className={`flex items-start gap-2 text-left px-3 py-2 rounded-lg border transition-all ${
                              isSelected
                                ? isCloud
                                  ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400'
                                  : 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                                : isCloud
                                  ? 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                                  : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold truncate ${
                                isSelected
                                  ? isCloud ? 'text-blue-700' : 'text-amber-700'
                                  : 'text-slate-700'
                              }`}>
                                {m.label}
                              </div>
                              {m.note && (
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">{m.note}</div>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                              isSelected
                                ? isCloud ? 'bg-blue-200 text-blue-800' : 'bg-amber-200 text-amber-800'
                                : isCloud ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {m.size}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ProviderActions
              onTest={() => testConnection('ollama')}
              testing={testing} testResult={testResult}
              canTest={true}
              testLabel="Test connection"
            />
          </div>
        )}
      </div>
    </Section>
  );
}

function ProviderActions({
  onTest, onClear, testing, testResult, canTest, testLabel = 'Test',
}: {
  onTest: () => void;
  onClear?: () => void;
  testing: boolean;
  testResult: { ok: boolean; msg: string } | null;
  canTest: boolean;
  testLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1">
      <button
        onClick={onTest}
        disabled={testing || !canTest}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
      >
        {testing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {testLabel}
      </button>
      {onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
        >
          <Trash2 size={13} /> Remove key
        </button>
      )}
      {testResult && (
        <span className={`text-sm flex items-center gap-1 ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {testResult.msg}
        </span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="text-sm text-slate-600">{label}</div>
      <div>{children}</div>
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
