import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sparkles, Copy, FileText, Mail, Hash, Type, Loader2, Check, AlertCircle,
  Calendar, Facebook, Instagram, Youtube, Linkedin, Globe, ChevronRight,
  CheckSquare, Square, Zap, LayoutList,
} from 'lucide-react';
import { useClients } from '../state/ClientContext';
import { useToast } from '../state/ToastContext';
import { Modal } from '../components/Modal';

// ─── constants ────────────────────────────────────────────────────────────────

type GenType = 'social_post' | 'email' | 'caption' | 'headline' | 'custom';
type Platform = 'facebook' | 'instagram' | 'youtube' | 'linkedin';
type WriterTab = 'write' | 'plan';

const TYPES: { id: GenType; label: string; icon: any }[] = [
  { id: 'social_post', label: 'Social Post', icon: Hash },
  { id: 'email',       label: 'Email',       icon: Mail },
  { id: 'caption',     label: 'Caption',     icon: Type },
  { id: 'headline',    label: 'Headlines',   icon: Type },
  { id: 'custom',      label: 'Custom',      icon: FileText },
];

const TONES = ['professional', 'friendly', 'casual', 'witty', 'urgent', 'inspirational', 'authoritative'];

const PLATFORMS: { id: Platform; label: string; color: string; Icon: any }[] = [
  { id: 'facebook',  label: 'Facebook',  color: '#1877f2', Icon: Facebook },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', Icon: Instagram },
  { id: 'youtube',   label: 'YouTube',   color: '#ff0000', Icon: Youtube },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2', Icon: Linkedin },
];

const PLAN_DURATIONS = [
  { weeks: 13, label: '3 months' },
  { weeks: 26, label: '6 months' },
  { weeks: 52, label: '1 year' },
];

const POSTS_PER_WEEK = [1, 2, 3, 5, 7];

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AIWriter() {
  const { clients, activeClient } = useClients();
  const { toast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState('');
  const [writerTab, setWriterTab] = useState<WriterTab>('write');

  useEffect(() => {
    window.api.ai.status().then((s) => {
      setConfigured(s.configured);
      setModel(s.model);
    });
  }, []);

  if (configured === null) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  if (!configured) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-semibold text-amber-900">AI provider not configured</div>
            <div className="text-sm text-amber-800 mt-1">
              Go to <strong>Settings → AI Content Writer</strong> and connect Claude, OpenAI, or Ollama to start generating content.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-brand-500" size={22} /> AI Content Writer
          </h1>
          <p className="text-sm text-slate-500">Generate branded content and full social media plans.</p>
        </div>
        <div className="text-xs text-slate-400 font-mono">{model}</div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {([
          { id: 'write' as WriterTab, label: 'Write Content', icon: Zap },
          { id: 'plan'  as WriterTab, label: 'Content Plan',  icon: LayoutList },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setWriterTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              writerTab === id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {writerTab === 'write' ? (
        <WriteTab clients={clients} activeClient={activeClient} toast={toast} />
      ) : (
        <PlanTab clients={clients} activeClient={activeClient} toast={toast} />
      )}
    </div>
  );
}

// ─── Write tab ────────────────────────────────────────────────────────────────

function WriteTab({ clients, activeClient, toast }: any) {
  const [type, setType] = useState<GenType>('social_post');
  const [allPlatforms, setAllPlatforms] = useState(false);
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [activePlatformTab, setActivePlatformTab] = useState<Platform>('facebook');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [variants, setVariants] = useState(1);
  const [topic, setTopic] = useState('');
  const [custom, setCustom] = useState('');
  const [clientId, setClientId] = useState<number | ''>(activeClient?.id ?? '');

  // Single-platform output
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // All-platforms output: map of platform → content
  const [multiOutput, setMultiOutput] = useState<Partial<Record<Platform, string>>>({});
  const [multiProgress, setMultiProgress] = useState<Platform | null>(null);

  // Calendar save modal
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [calDate, setCalDate] = useState(todayYMD());
  const [calPlatform, setCalPlatform] = useState<string>('');
  const [calContent, setCalContent] = useState('');

  const requestId = useRef('');

  useEffect(() => { setClientId(activeClient?.id ?? ''); }, [activeClient]);

  useEffect(() => {
    const offChunk = window.api.ai.onChunk((p) => {
      if (p.requestId !== requestId.current) return;
      setOutput((prev) => prev + p.text);
    });
    const offDone = window.api.ai.onDone((p) => {
      if (p.requestId !== requestId.current) return;
      setBusy(false);
    });
    const offErr = window.api.ai.onError((p) => {
      if (p.requestId !== requestId.current) return;
      setError(p.error);
      setBusy(false);
    });
    return () => { offChunk(); offDone(); offErr(); };
  }, []);

  const clientCtx = clientId ? clients.find((c: any) => c.id === Number(clientId)) ?? null : null;

  const makeClientContext = (c: any) => c ? {
    name:            c.name,
    company:         c.company        || undefined,
    notes:           c.notes          || undefined,
    brand_about:     c.brand_about    || undefined,
    target_audience: c.target_audience|| undefined,
    services:        c.services       || undefined,
    brand_voice:     c.brand_voice    || undefined,
    social_goals:    c.social_goals   || undefined,
    keywords:        c.keywords       || undefined,
    website:         c.website        || undefined,
  } : null;

  const generateSingle = async (plt: Platform) => {
    requestId.current = `${Date.now()}-${plt}`;
    const result = await window.api.ai.generate(
      {
        type,
        platform: (type === 'social_post' || type === 'caption') ? plt : null,
        topic: topic.trim(),
        tone, length, variants,
        custom_instructions: custom.trim() || undefined,
        client_context: makeClientContext(clientCtx),
      },
      requestId.current
    );
    return result;
  };

  const generate = async () => {
    if (!topic.trim()) return;
    setError('');
    setCopied(false);

    if (allPlatforms && (type === 'social_post' || type === 'caption')) {
      // Generate for all platforms sequentially
      const newMulti: Partial<Record<Platform, string>> = {};
      setMultiOutput({});
      setActivePlatformTab('facebook');
      for (const plt of PLATFORMS.map((p) => p.id)) {
        setMultiProgress(plt);
        setBusy(true);
        setOutput('');
        requestId.current = `${Date.now()}-${plt}`;
        let text = '';
        // Stream directly to temp state, collect full text
        const done = new Promise<void>((res) => {
          const offChunk = window.api.ai.onChunk((p) => {
            if (p.requestId !== requestId.current) return;
            text += p.text;
            setOutput(text);
          });
          const offDone = window.api.ai.onDone((p) => {
            if (p.requestId !== requestId.current) return;
            offChunk(); offDone(); offErr();
            res();
          });
          const offErr = window.api.ai.onError((p) => {
            if (p.requestId !== requestId.current) return;
            offChunk(); offDone(); offErr();
            res();
          });
        });
        await window.api.ai.generate(
          {
            type,
            platform: plt,
            topic: topic.trim(),
            tone, length, variants,
            custom_instructions: custom.trim() || undefined,
            client_context: makeClientContext(clientCtx),
          },
          requestId.current
        );
        await done;
        newMulti[plt] = text;
        setMultiOutput({ ...newMulti });
      }
      setMultiProgress(null);
      setBusy(false);
      setOutput('');
    } else {
      // Single platform
      setBusy(true);
      setOutput('');
      await generateSingle(platform);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openCalModal = (content: string, plt: string) => {
    setCalContent(content);
    setCalPlatform(plt);
    setCalDate(todayYMD());
    setCalModalOpen(true);
  };

  const saveToCalendar = async () => {
    await window.api.content.create({
      client_id: clientId ? Number(clientId) : null,
      platform: calPlatform || null,
      type,
      content: calContent,
      scheduled_date: calDate,
      status: 'draft',
    });
    setCalModalOpen(false);
    toast('success', 'Saved to calendar', `Scheduled for ${calDate}`);
  };

  const saveAsNote = async (text: string) => {
    if (!text.trim() || !clientId) return;
    await window.api.notes.create({
      client_id: Number(clientId),
      body: `[AI ${type}]\n\n${text}`,
    });
    toast('success', 'Saved as note');
  };

  const isMultiMode = allPlatforms && (type === 'social_post' || type === 'caption');
  const hasMultiOutput = Object.values(multiOutput).some(Boolean);
  const activeMultiContent = multiOutput[activePlatformTab] || '';

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* ── Left: form ── */}
      <div className="space-y-3">
        {/* Content type */}
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1.5">Content type</div>
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs transition ${
                  type === t.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <t.icon size={14} />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Platform selector */}
        {(type === 'social_post' || type === 'caption') && (
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1.5">Platform</div>
            <div className="flex flex-wrap gap-1.5">
              {/* All platforms toggle */}
              <button
                onClick={() => setAllPlatforms(!allPlatforms)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  allPlatforms ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe size={13} /> All platforms
              </button>
              {PLATFORMS.map((p) => {
                const active = !allPlatforms && platform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setAllPlatforms(false); setPlatform(p.id); }}
                    disabled={allPlatforms}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      active ? 'text-white border-transparent' : 'bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-40'
                    }`}
                    style={active ? { background: p.color, borderColor: p.color } : {}}
                  >
                    <p.Icon size={13} /> {p.label}
                  </button>
                );
              })}
            </div>
            {allPlatforms && (
              <p className="text-[11px] text-brand-500 mt-1.5 flex items-center gap-1">
                <Sparkles size={10} /> Will generate separate posts for all 4 platforms
              </p>
            )}
          </div>
        )}

        {/* Client */}
        <Field label="Client (for brand voice)">
          <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')} className="w-full input">
            <option value="">— No client context —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
          </select>
        </Field>

        {/* Topic */}
        <Field label="Topic / what to say *">
          <textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Announce our new monthly skincare bundle, 20% off until Friday."
            className="w-full input"
          />
        </Field>

        {/* Options row */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tone">
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full input">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Length">
            <select value={length} onChange={(e) => setLength(e.target.value as any)} className="w-full input">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </Field>
          <Field label="Variants">
            <select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full input">
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Extra instructions (optional)">
          <input value={custom} onChange={(e) => setCustom(e.target.value)}
            placeholder="Avoid emojis, mention urgency, end with a question, etc."
            className="w-full input"
          />
        </Field>

        <button
          onClick={generate}
          disabled={busy || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 font-medium"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy
            ? isMultiMode ? `Generating ${multiProgress || ''}…` : 'Generating…'
            : isMultiMode ? 'Generate for all platforms' : 'Generate'}
        </button>
      </div>

      {/* ── Right: output ── */}
      <div>
        {isMultiMode ? (
          /* Multi-platform output */
          <div className="space-y-2">
            {/* Platform tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {PLATFORMS.map((p) => {
                const done = !!multiOutput[p.id];
                const loading = multiProgress === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatformTab(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      activePlatformTab === p.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <p.Icon size={12} style={{ color: p.color }} />
                    {p.label}
                    {loading && <Loader2 size={10} className="animate-spin text-brand-500" />}
                    {done && !loading && <Check size={10} className="text-emerald-500" />}
                  </button>
                );
              })}
            </div>
            <OutputActions
              content={activeMultiContent}
              platform={activePlatformTab}
              clientId={clientId}
              onCalendar={() => openCalModal(activeMultiContent, activePlatformTab)}
              onNote={() => saveAsNote(activeMultiContent)}
              onCopy={() => copy(activeMultiContent)}
              copied={copied}
            />
            <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-64 max-h-[500px] overflow-auto">
              {error ? (
                <div className="text-sm text-red-600 flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>
              ) : activeMultiContent ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{activeMultiContent}</pre>
              ) : (
                <div className="text-sm text-slate-400 text-center py-8">
                  {multiProgress ? `Generating ${multiProgress} content…` : hasMultiOutput ? 'Select a platform tab above' : 'Click "Generate for all platforms" to start.'}
                </div>
              )}
            </div>
            {/* Save all to calendar */}
            {hasMultiOutput && (
              <button
                onClick={async () => {
                  let saved = 0;
                  for (const [plt, content] of Object.entries(multiOutput)) {
                    if (!content) continue;
                    await window.api.content.create({
                      client_id: clientId ? Number(clientId) : null,
                      platform: plt,
                      type: 'social_post',
                      content,
                      scheduled_date: calDate || todayYMD(),
                      status: 'draft',
                    });
                    saved++;
                  }
                  toast('success', `${saved} posts saved to calendar`, 'Open Content Calendar to schedule dates.');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg"
              >
                <Calendar size={14} /> Save all platforms to calendar
              </button>
            )}
          </div>
        ) : (
          /* Single-platform output */
          <div className="space-y-2">
            <OutputActions
              content={output}
              platform={type === 'social_post' || type === 'caption' ? platform : ''}
              clientId={clientId}
              onCalendar={() => openCalModal(output, platform)}
              onNote={() => saveAsNote(output)}
              onCopy={() => copy(output)}
              copied={copied}
            />
            <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-[400px] max-h-[580px] overflow-auto">
              {error ? (
                <div className="text-sm text-red-600 flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</div>
              ) : output ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{output}</pre>
              ) : (
                <div className="text-sm text-slate-400 text-center py-12">
                  {busy ? 'Generating…' : 'Output will appear here.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calendar date modal */}
      <Modal open={calModalOpen} onClose={() => setCalModalOpen(false)} title="Save to Content Calendar" width="max-w-sm">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Scheduled date</div>
            <input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} className="w-full input" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Platform</div>
            <select value={calPlatform} onChange={(e) => setCalPlatform(e.target.value)} className="w-full input">
              <option value="">— Any —</option>
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 max-h-28 overflow-auto whitespace-pre-wrap">
            {calContent.slice(0, 300)}{calContent.length > 300 ? '…' : ''}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCalModalOpen(false)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100">Cancel</button>
            <button onClick={saveToCalendar} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">Save to calendar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Plan tab ─────────────────────────────────────────────────────────────────

function PlanTab({ clients, activeClient, toast }: any) {
  const [clientId, setClientId] = useState<number | ''>(activeClient?.id ?? '');
  const [weeks, setWeeks] = useState(13);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['facebook', 'instagram', 'linkedin']);
  const [themes, setThemes] = useState('');
  const [tone, setTone] = useState('professional');
  const [startDate, setStartDate] = useState(todayYMD());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ batch: number; total: number; label: string; collected: number } | null>(null);
  const [plan, setPlan] = useState<{ date: string; platform: string; topic: string; content: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState<{ date: string; platform: string; topic: string; content: string } | null>(null);

  useEffect(() => { setClientId(activeClient?.id ?? ''); }, [activeClient]);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const clientCtx = clientId ? clients.find((c: any) => c.id === Number(clientId)) : null;

  const generatePlan = async () => {
    if (!selectedPlatforms.length) { toast('error', 'Select at least one platform'); return; }
    setGenerating(true);
    setProgress(null);
    setPlan([]);

    // Subscribe to progress events
    const offProgress = window.api.ai.onPlanProgress((p) => setProgress(p));
    const offChunk = window.api.ai.onPlanChunk(() => {}); // keep channel open

    const r = await window.api.ai.generatePlan({
      clientName:     clientCtx?.name          ?? null,
      clientCompany:  clientCtx?.company        ?? null,
      clientNotes:    clientCtx?.notes          ?? null,
      brandAbout:     clientCtx?.brand_about    ?? null,
      targetAudience: clientCtx?.target_audience?? null,
      services:       clientCtx?.services       ?? null,
      brandVoice:     clientCtx?.brand_voice    ?? null,
      socialGoals:    clientCtx?.social_goals   ?? null,
      keywords:       clientCtx?.keywords       ?? null,
      website:        clientCtx?.website        ?? null,
      platforms: selectedPlatforms,
      postsPerWeek,
      startDate,
      weeks,
      themes: themes.trim() || undefined,
      tone,
    });

    offProgress();
    offChunk();

    if (!r.ok || !r.posts) {
      toast('error', 'Plan generation failed', r.error);
    } else {
      setPlan(r.posts);
      toast('success', 'Plan generated', `${r.posts.length} posts ready`);
    }
    setGenerating(false);
    setProgress(null);
  };

  const saveAllToCalendar = async () => {
    if (!plan.length) return;
    setSaving(true);
    for (const post of plan) {
      await window.api.content.create({
        client_id: clientId ? Number(clientId) : null,
        platform: post.platform || null,
        type: 'social_post',
        content: post.content,
        scheduled_date: post.date,
        status: 'scheduled',
      });
    }
    setSaving(false);
    toast('success', `${plan.length} posts saved to calendar`, 'Open Content Calendar to review.');
    setPlan([]);
  };

  const totalPosts = selectedPlatforms.length * postsPerWeek * weeks;
  const endDate = (() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().slice(0, 10);
  })();

  // Group plan by week for display
  const byWeek = plan.reduce<Record<string, typeof plan>>((acc, post) => {
    const d = new Date(post.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* ── Left: plan settings ── */}
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-100 rounded-xl p-4">
          <div className="font-semibold text-sm text-slate-700 mb-1 flex items-center gap-2">
            <LayoutList size={15} className="text-brand-500" /> Content Plan Generator
          </div>
          <p className="text-xs text-slate-500">
            AI will create a full posting schedule — topics, copy, and dates — ready to save to your calendar.
          </p>
        </div>

        <Field label="Client">
          <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')} className="w-full input">
            <option value="">— No client context —</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ''}</option>)}
          </select>
        </Field>

        <div>
          <div className="text-xs font-medium text-slate-600 mb-1.5">Plan duration</div>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_DURATIONS.map((d) => (
              <button key={d.weeks} onClick={() => setWeeks(d.weeks)}
                className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                  weeks === d.weeks ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-200 hover:border-brand-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-slate-600 mb-1.5">Platforms</div>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => {
              const on = selectedPlatforms.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
                    on ? 'border-transparent text-white' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                  style={on ? { background: p.color } : {}}
                >
                  {on ? <CheckSquare size={15} /> : <Square size={15} />}
                  <p.Icon size={14} /> {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Posts / week / platform">
            <select value={postsPerWeek} onChange={(e) => setPostsPerWeek(Number(e.target.value))} className="w-full input">
              {POSTS_PER_WEEK.map((n) => <option key={n} value={n}>{n} post{n > 1 ? 's' : ''}</option>)}
            </select>
          </Field>
          <Field label="Start date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand tone">
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full input">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Content themes & topics (optional)">
          <textarea rows={3} value={themes} onChange={(e) => setThemes(e.target.value)}
            placeholder="e.g. New product launches, client success stories, industry tips, behind the scenes, seasonal promotions…"
            className="w-full input"
          />
        </Field>

        {/* Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <div className="flex justify-between"><span>Period</span><span className="font-medium">{startDate} → {endDate}</span></div>
          <div className="flex justify-between"><span>Platforms</span><span className="font-medium">{selectedPlatforms.length || '—'}</span></div>
          <div className="flex justify-between"><span>Posts per week</span><span className="font-medium">{postsPerWeek} × {selectedPlatforms.length} = {postsPerWeek * selectedPlatforms.length}</span></div>
          <div className="flex justify-between font-semibold text-brand-600"><span>Total posts</span><span>{selectedPlatforms.length ? totalPosts : '—'}</span></div>
        </div>

        <button
          onClick={generatePlan}
          disabled={generating || !selectedPlatforms.length}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 font-medium"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? (progress ? progress.label : 'Starting…') : `Generate ${totalPosts ? totalPosts + '-post ' : ''}content plan`}
        </button>

        {/* Live batch progress bar */}
        {generating && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{progress.label}</span>
              <span>Batch {progress.batch}/{progress.total} · {progress.collected} posts collected</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(progress.batch / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Right: plan output ── */}
      <div className="space-y-3">
        {plan.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{plan.length} posts generated</div>
              <button
                onClick={saveAllToCalendar}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                {saving ? 'Saving…' : 'Save all to calendar'}
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {Object.entries(byWeek).map(([weekStart, posts]) => {
                const d = new Date(weekStart);
                const weekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={weekStart} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Calendar size={11} /> Week of {weekLabel}
                      <span className="ml-auto text-slate-400">{posts.length} posts</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {posts.map((post, i) => {
                        const meta = PLATFORMS.find((p) => p.id === post.platform);
                        const Icon = meta?.Icon ?? Globe;
                        return (
                          <button
                            key={i}
                            onClick={() => { setPreviewPost(post); setPreviewOpen(true); }}
                            className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: meta?.color || '#64748b' }}>
                              <Icon size={13} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-700 truncate">{post.topic}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{post.content.slice(0, 80)}…</div>
                            </div>
                            <div className="text-[10px] text-slate-400 shrink-0 mt-1">{post.date}</div>
                            <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center gap-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <LayoutList size={32} className="text-slate-300" />
            <div className="text-slate-400 text-sm">
              Configure your plan on the left and click Generate.<br />
              <span className="text-xs">AI will create ready-to-publish posts for each date and platform.</span>
            </div>
          </div>
        )}
      </div>

      {/* Post preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Post preview" width="max-w-xl">
        {previewPost && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-slate-400">Date</div>{previewPost.date}</div>
              <div><div className="text-xs text-slate-400">Platform</div>
                {PLATFORMS.find((p) => p.id === previewPost.platform)?.label ?? previewPost.platform}
              </div>
              <div className="col-span-2"><div className="text-xs text-slate-400">Topic</div>{previewPost.topic}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-sm whitespace-pre-wrap leading-relaxed">{previewPost.content}</div>
            <div className="flex justify-between">
              <button
                onClick={async () => { await navigator.clipboard.writeText(previewPost.content); toast('info', 'Copied'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Copy size={13} /> Copy
              </button>
              <button
                onClick={async () => {
                  await window.api.content.create({
                    client_id: clientId ? Number(clientId) : null,
                    platform: previewPost.platform,
                    type: 'social_post',
                    content: previewPost.content,
                    scheduled_date: previewPost.date,
                    status: 'scheduled',
                  });
                  setPreviewOpen(false);
                  toast('success', 'Saved to calendar');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                <Calendar size={13} /> Save to calendar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function OutputActions({ content, platform, clientId, onCalendar, onNote, onCopy, copied }: {
  content: string; platform: string; clientId: number | '';
  onCalendar: () => void; onNote: () => void; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium text-slate-500">Output</div>
      <div className="flex items-center gap-2">
        {content && (
          <button onClick={onCalendar} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-violet-50 text-violet-600">
            <Calendar size={12} /> Save to calendar
          </button>
        )}
        {clientId && content && (
          <button onClick={onNote} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600">
            <FileText size={12} /> Save as note
          </button>
        )}
        {content && (
          <button onClick={onCopy} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600">
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
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
