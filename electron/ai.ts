import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { BrowserWindow } from 'electron';
import { getDb, save } from './db';

export type Provider = 'anthropic' | 'openai' | 'ollama';

const ANTHROPIC_DEFAULT = 'claude-haiku-4-5-20251001';
const OPENAI_DEFAULT    = 'gpt-4o-mini';
const OLLAMA_DEFAULT    = 'llama3.2';
const OLLAMA_URL_DEFAULT = 'http://localhost:11434';

const SYSTEM_PROMPT = `You are A1 CRM's content writer for a digital marketing agency. You produce ready-to-publish copy: social media posts, captions, headlines, and marketing emails.

Rules:
- Match the requested tone exactly (professional / casual / friendly / witty / urgent / inspirational).
- Respect platform conventions: Facebook (1–3 short paras, 1–3 hashtags), Instagram (hook + emoji-friendly + 5–10 hashtags), LinkedIn (professional, no emojis unless asked, line breaks for scannability), YouTube (titles ≤70 chars, descriptions with chapters/CTA), Email (clear subject + scannable body + CTA).
- When given a client/brand context, sound like that brand — never generic.
- Output ONLY the requested copy. No preamble, no "Here's your post:", no closing remarks. If multiple variants are requested, separate each with "---" on its own line.
- For emails, format as:
  Subject: <subject line>

  <email body>
- Never invent facts about the brand that weren't given. If you need detail, use a [bracketed placeholder] like [link] or [date].`;

interface GenerateOpts {
  type: 'social_post' | 'email' | 'caption' | 'headline' | 'custom';
  platform?: 'facebook' | 'instagram' | 'youtube' | 'linkedin' | null;
  topic: string;
  tone?: string;
  length?: 'short' | 'medium' | 'long';
  variants?: number;
  client_context?: {
    name?: string;
    company?: string;
    notes?: string;
    brand_about?: string;
    target_audience?: string;
    services?: string;
    brand_voice?: string;
    social_goals?: string;
    keywords?: string;
    website?: string;
  } | null;
  custom_instructions?: string;
}

function buildPrompt(opts: GenerateOpts): string {
  const lines: string[] = [];

  // Task
  if (opts.type === 'social_post') lines.push(`Task: write a social media post.`);
  else if (opts.type === 'email')   lines.push(`Task: write a marketing email (subject + body).`);
  else if (opts.type === 'caption') lines.push(`Task: write a caption.`);
  else if (opts.type === 'headline') lines.push(`Task: write headline options.`);
  else lines.push(`Task: write marketing copy.`);

  if (opts.platform) lines.push(`Platform: ${opts.platform}.`);
  if (opts.tone)     lines.push(`Tone: ${opts.tone}.`);
  if (opts.length)   lines.push(`Length: ${opts.length}.`);
  if (opts.variants && opts.variants > 1)
    lines.push(`Provide ${opts.variants} distinct variants separated by --- on its own line.`);

  // Brand profile context
  const c = opts.client_context;
  if (c) {
    lines.push('');
    lines.push('=== BRAND PROFILE ===');
    if (c.name)            lines.push(`Brand name: ${c.name}${c.company ? ` (${c.company})` : ''}`);
    if (c.brand_about)     lines.push(`About: ${c.brand_about}`);
    if (c.services)        lines.push(`Services / products: ${c.services}`);
    if (c.target_audience) lines.push(`Target audience: ${c.target_audience}`);
    if (c.brand_voice)     lines.push(`Brand voice: ${c.brand_voice}`);
    if (c.social_goals)    lines.push(`Social media goals: ${c.social_goals}`);
    if (c.keywords)        lines.push(`Brand keywords / hashtags to use: ${c.keywords}`);
    if (c.website)         lines.push(`Website: ${c.website}`);
    if (c.notes)           lines.push(`Additional notes: ${c.notes}`);
    lines.push('=== END BRAND PROFILE ===');
  }

  if (opts.custom_instructions) {
    lines.push('');
    lines.push(`Extra instructions: ${opts.custom_instructions}`);
  }
  lines.push('');
  lines.push(`Topic / what to say: ${opts.topic}`);
  return lines.join('\n');
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function aiStatus() {
  const db = getDb();
  const provider = (db.settings['ai.provider'] as Provider) || 'anthropic';

  const anthropicConfigured = !!(db.settings['ai.anthropic_key'] || '').trim();
  const openaiConfigured    = !!(db.settings['ai.openai_key']    || '').trim();
  const ollamaUrl           = (db.settings['ai.ollama_url']  || OLLAMA_URL_DEFAULT).trim();
  const ollamaModel         = (db.settings['ai.ollama_model'] || OLLAMA_DEFAULT).trim();
  const ollamaConfigured    = true; // Ollama needs no API key — just a running server

  const anthropicModel = db.settings['ai.anthropic_model'] || ANTHROPIC_DEFAULT;
  const openaiModel    = db.settings['ai.openai_key']  ? db.settings['ai.openai_model'] || OPENAI_DEFAULT : OPENAI_DEFAULT;

  const configured =
    provider === 'openai'   ? openaiConfigured :
    provider === 'ollama'   ? ollamaConfigured :
    anthropicConfigured;

  const model =
    provider === 'openai'   ? openaiModel :
    provider === 'ollama'   ? ollamaModel :
    anthropicModel;

  return {
    provider,
    configured,
    model,
    anthropicConfigured,
    anthropicModel,
    openaiConfigured,
    openaiModel,
    ollamaConfigured,
    ollamaModel,
    ollamaUrl,
  };
}

function activeProvider(): Provider {
  return (getDb().settings['ai.provider'] as Provider) || 'anthropic';
}

// ─── Generators ───────────────────────────────────────────────────────────────

async function generateAnthropic(opts: GenerateOpts, requestId: string, win?: BrowserWindow) {
  const db = getDb();
  const key = (db.settings['ai.anthropic_key'] || '').trim();
  if (!key) return { ok: false, error: 'Anthropic API key not set. Go to Settings → AI Writer.' };
  const model = db.settings['ai.anthropic_model'] || ANTHROPIC_DEFAULT;
  const client = new Anthropic({ apiKey: key });
  try {
    const stream = await client.messages.stream({
      model,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildPrompt(opts) }],
    });
    let full = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        full += event.delta.text;
        win?.webContents.send('ai:chunk', { requestId, text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    win?.webContents.send('ai:done', { requestId, text: full, usage: final.usage });
    return { ok: true, text: full, usage: final.usage };
  } catch (err: any) {
    const msg = err?.message || String(err);
    win?.webContents.send('ai:error', { requestId, error: msg });
    return { ok: false, error: msg };
  }
}

async function generateOpenAI(opts: GenerateOpts, requestId: string, win?: BrowserWindow) {
  const db = getDb();
  const key = (db.settings['ai.openai_key'] || '').trim();
  if (!key) return { ok: false, error: 'OpenAI API key not set. Go to Settings → AI Writer.' };
  const model = db.settings['ai.openai_model'] || OPENAI_DEFAULT;
  const client = new OpenAI({ apiKey: key });
  try {
    const stream = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildPrompt(opts) },
      ],
    });
    let full = '';
    let usage: any;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) { full += delta; win?.webContents.send('ai:chunk', { requestId, text: delta }); }
      if (chunk.usage) usage = chunk.usage;
    }
    win?.webContents.send('ai:done', { requestId, text: full, usage });
    return { ok: true, text: full, usage };
  } catch (err: any) {
    const msg = err?.message || String(err);
    win?.webContents.send('ai:error', { requestId, error: msg });
    return { ok: false, error: msg };
  }
}

async function generateOllama(opts: GenerateOpts, requestId: string, win?: BrowserWindow) {
  const db = getDb();
  const baseURL = (db.settings['ai.ollama_url'] || OLLAMA_URL_DEFAULT).trim().replace(/\/$/, '');
  const model   = (db.settings['ai.ollama_model'] || OLLAMA_DEFAULT).trim();

  // Ollama exposes an OpenAI-compatible endpoint at /v1
  const client = new OpenAI({ apiKey: 'ollama', baseURL: `${baseURL}/v1` });
  try {
    const stream = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildPrompt(opts) },
      ],
    });
    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) { full += delta; win?.webContents.send('ai:chunk', { requestId, text: delta }); }
    }
    win?.webContents.send('ai:done', { requestId, text: full });
    return { ok: true, text: full };
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Friendlier message when Ollama isn't running
    const friendly = msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
      ? `Cannot connect to Ollama at ${baseURL}. Make sure Ollama is running.`
      : msg;
    win?.webContents.send('ai:error', { requestId, error: friendly });
    return { ok: false, error: friendly };
  }
}

export async function aiGenerate(opts: GenerateOpts, requestId: string, win?: BrowserWindow) {
  const p = activeProvider();
  if (p === 'openai') return generateOpenAI(opts, requestId, win);
  if (p === 'ollama') return generateOllama(opts, requestId, win);
  return generateAnthropic(opts, requestId, win);
}

// ─── Content Plan Generation ───────────────────────────────────────────────────

export interface PlanPost {
  date: string;      // YYYY-MM-DD
  platform: string;
  topic: string;
  content: string;
}

interface PlanOpts {
  clientName?: string | null;
  clientCompany?: string | null;
  clientNotes?: string | null;
  // Brand profile fields
  brandAbout?: string | null;
  targetAudience?: string | null;
  services?: string | null;
  brandVoice?: string | null;
  socialGoals?: string | null;
  keywords?: string | null;
  website?: string | null;
  platforms: string[];
  postsPerWeek: number;
  startDate: string; // YYYY-MM-DD
  weeks: number;
  themes?: string;
  tone?: string;
}

interface BatchRange {
  batchStart: string;   // YYYY-MM-DD
  batchEnd: string;     // YYYY-MM-DD
  batchWeeks: number;
  label: string;        // e.g. "Month 1 (Jan)"
}

/** Split the full plan period into monthly batches (≤4 weeks each) */
function buildBatches(startDate: string, totalWeeks: number): BatchRange[] {
  const batches: BatchRange[] = [];
  let cursor = new Date(startDate);
  let remaining = totalWeeks;
  let batchNum = 1;

  while (remaining > 0) {
    const batchWeeks = Math.min(4, remaining);
    const batchStart = cursor.toISOString().slice(0, 10);
    const batchEnd = new Date(cursor);
    batchEnd.setDate(cursor.getDate() + batchWeeks * 7 - 1);
    const label = `Month ${batchNum} (${cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
    batches.push({ batchStart, batchEnd: batchEnd.toISOString().slice(0, 10), batchWeeks, label });
    cursor.setDate(cursor.getDate() + batchWeeks * 7);
    remaining -= batchWeeks;
    batchNum++;
  }
  return batches;
}

function buildBatchPrompt(opts: PlanOpts, batch: BatchRange): string {
  const postsInBatch = opts.platforms.length * opts.postsPerWeek * batch.batchWeeks;

  const brandLines: string[] = [];
  if (opts.clientName)     brandLines.push(`Brand name: ${opts.clientName}${opts.clientCompany ? ` (${opts.clientCompany})` : ''}`);
  if (opts.brandAbout)     brandLines.push(`About: ${opts.brandAbout}`);
  if (opts.services)       brandLines.push(`Services/products: ${opts.services}`);
  if (opts.targetAudience) brandLines.push(`Target audience: ${opts.targetAudience}`);
  if (opts.brandVoice)     brandLines.push(`Brand voice: ${opts.brandVoice}`);
  if (opts.socialGoals)    brandLines.push(`Social media goals: ${opts.socialGoals}`);
  if (opts.keywords)       brandLines.push(`Brand keywords/hashtags: ${opts.keywords}`);
  if (opts.website)        brandLines.push(`Website: ${opts.website}`);
  if (opts.clientNotes)    brandLines.push(`Notes: ${opts.clientNotes}`);

  return [
    `You are a social media content strategist. Output ONLY a valid JSON array — no markdown, no explanation, nothing before or after the array brackets.`,
    ``,
    `Task: Create ${postsInBatch} social media posts for the period ${batch.batchStart} to ${batch.batchEnd}.`,
    ``,
    brandLines.length ? '=== BRAND PROFILE ===' : '',
    ...brandLines,
    brandLines.length ? '=== END BRAND PROFILE ===' : '',
    ``,
    `Platforms: ${opts.platforms.join(', ')}.`,
    `Posts per week per platform: ${opts.postsPerWeek}.`,
    opts.themes ? `Content themes focus: ${opts.themes}.` : '',
    opts.tone ? `Tone: ${opts.tone}.` : '',
    ``,
    `Rules:`,
    `- Spread posts evenly across ${batch.batchWeeks} week(s) starting ${batch.batchStart}`,
    `- Vary content types: promotional, educational, engagement, behind-the-scenes, testimonials`,
    `- Match each platform's style and conventions`,
    `- Use brand keywords/hashtags where natural`,
    `- If brand voice is specified, match it exactly`,
    ``,
    `Return exactly this JSON structure (no extra keys):`,
    `[{"date":"YYYY-MM-DD","platform":"facebook|instagram|linkedin|youtube","topic":"max 8 words","content":"ready post copy, max 220 chars"},...]`,
    ``,
    `Expected: ${postsInBatch} objects. Dates must be between ${batch.batchStart} and ${batch.batchEnd}.`,
  ].filter((l) => l !== undefined).join('\n');
}

/** Stream a single batch prompt and collect the full text */
async function streamBatch(prompt: string, win: BrowserWindow | undefined): Promise<string> {
  const provider = activeProvider();
  const db = getDb();

  if (provider === 'openai') {
    const key = (db.settings['ai.openai_key'] || '').trim();
    if (!key) throw new Error('OpenAI API key not set. Go to Settings → AI Writer.');
    const model = db.settings['ai.openai_model'] || OPENAI_DEFAULT;
    const client = new OpenAI({ apiKey: key });
    const stream = await client.chat.completions.create({
      model, max_tokens: 4096, stream: true,
      messages: [{ role: 'user', content: prompt }],
    });
    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        win?.webContents.send('ai:plan-chunk', { text: delta });
      }
    }
    return full;
  }

  if (provider === 'ollama') {
    const baseURL = (db.settings['ai.ollama_url'] || OLLAMA_URL_DEFAULT).trim().replace(/\/$/, '');
    const model = (db.settings['ai.ollama_model'] || OLLAMA_DEFAULT).trim();
    const client = new OpenAI({ apiKey: 'ollama', baseURL: `${baseURL}/v1` });
    try {
      const stream = await client.chat.completions.create({
        model, max_tokens: 4096, stream: true,
        messages: [{ role: 'user', content: prompt }],
      });
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) { full += delta; win?.webContents.send('ai:plan-chunk', { text: delta }); }
      }
      return full;
    } catch (err: any) {
      const msg = err?.message || String(err);
      throw new Error(
        msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
          ? `Cannot connect to Ollama. Make sure it is running.`
          : msg
      );
    }
  }

  // Anthropic
  const key = (db.settings['ai.anthropic_key'] || '').trim();
  if (!key) throw new Error('Anthropic API key not set. Go to Settings → AI Writer.');
  const model = db.settings['ai.anthropic_model'] || ANTHROPIC_DEFAULT;
  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model, max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  let full = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      win?.webContents.send('ai:plan-chunk', { text: event.delta.text });
    }
  }
  return full;
}

/** Extract and parse a JSON array from raw AI text, handling markdown fences */
function extractJsonArray(raw: string): PlanPost[] {
  // Strip markdown code fences
  let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

  // Find the outermost [ ... ]
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in AI response.');
  }
  const jsonStr = clean.slice(start, end + 1);

  // Attempt direct parse
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed as PlanPost[];
  } catch {
    // Try to fix common truncation: unclosed last object
    const fixed = jsonStr.replace(/,?\s*\{[^}]*$/, '') + ']';
    const parsed = JSON.parse(fixed);
    if (Array.isArray(parsed)) return parsed as PlanPost[];
  }
  throw new Error('Could not parse JSON array from response.');
}

export async function aiGeneratePlan(
  opts: PlanOpts,
  win?: BrowserWindow
): Promise<{ ok: boolean; posts?: PlanPost[]; error?: string }> {
  const batches = buildBatches(opts.startDate, opts.weeks);
  const allPosts: PlanPost[] = [];

  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      // Notify frontend of progress
      win?.webContents.send('ai:plan-progress', {
        batch: i + 1,
        total: batches.length,
        label: `Generating ${batch.label}…`,
        collected: allPosts.length,
      });

      const prompt = buildBatchPrompt(opts, batch);
      const raw = await streamBatch(prompt, win);

      let batchPosts: PlanPost[];
      try {
        batchPosts = extractJsonArray(raw);
      } catch (parseErr: any) {
        // If parsing fails for one batch, skip it and continue
        win?.webContents.send('ai:plan-progress', {
          batch: i + 1, total: batches.length,
          label: `⚠ Skipped ${batch.label} (parse error) — continuing…`,
          collected: allPosts.length,
        });
        console.error(`Plan batch ${i + 1} parse error:`, parseErr.message, '\nRaw:', raw.slice(0, 200));
        continue;
      }

      allPosts.push(...batchPosts);
    }

    if (!allPosts.length) {
      return { ok: false, error: 'No posts were generated. Check your API key and try again.' };
    }

    return { ok: true, posts: allPosts };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ─── Key test ─────────────────────────────────────────────────────────────────

export async function aiTestKey(provider: Provider, key: string) {
  try {
    if (provider === 'anthropic') {
      const c = new Anthropic({ apiKey: key });
      const r = await c.messages.create({
        model: ANTHROPIC_DEFAULT, max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with just: OK' }],
      });
      const block = r.content[0];
      return { ok: true, response: block?.type === 'text' ? block.text.trim() : '' };
    }
    if (provider === 'openai') {
      const c = new OpenAI({ apiKey: key });
      const r = await c.chat.completions.create({
        model: OPENAI_DEFAULT, max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with just: OK' }],
      });
      return { ok: true, response: (r.choices[0]?.message?.content || '').trim() };
    }
    // Ollama — no key, just connectivity check
    const db = getDb();
    const baseURL = (db.settings['ai.ollama_url'] || OLLAMA_URL_DEFAULT).trim().replace(/\/$/, '');
    const model   = (db.settings['ai.ollama_model'] || OLLAMA_DEFAULT).trim();
    const c = new OpenAI({ apiKey: 'ollama', baseURL: `${baseURL}/v1` });
    const r = await c.chat.completions.create({
      model, max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with just: OK' }],
    });
    return { ok: true, response: (r.choices[0]?.message?.content || '').trim() };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const friendly = msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
      ? 'Cannot connect to Ollama. Make sure it is running.'
      : msg;
    return { ok: false, error: friendly };
  }
}

// ─── List Ollama models from running server ────────────────────────────────────

export async function aiListOllamaModels(url?: string) {
  const baseURL = (url || getDb().settings['ai.ollama_url'] || OLLAMA_URL_DEFAULT).trim().replace(/\/$/, '');
  try {
    const res = await fetch(`${baseURL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const json: any = await res.json();
    const models: string[] = (json.models || []).map((m: any) => m.name as string);
    return { ok: true, models };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const friendly = msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
      ? 'Ollama is not running. Start it with: ollama serve'
      : msg;
    return { ok: false, models: [], error: friendly };
  }
}

// ─── Setters ──────────────────────────────────────────────────────────────────

export function aiSetProvider(provider: Provider) {
  const valid: Provider[] = ['anthropic', 'openai', 'ollama'];
  const db = getDb();
  db.settings['ai.provider'] = valid.includes(provider) ? provider : 'anthropic';
  save();
  return { ok: true };
}

export function aiSetKey(provider: Provider, key: string) {
  const db = getDb();
  const k =
    provider === 'openai' ? 'ai.openai_key' :
    provider === 'ollama' ? 'ai.ollama_url' :   // for Ollama "key" is the base URL
    'ai.anthropic_key';
  db.settings[k] = (key || '').trim();
  save();
  return { ok: true };
}

export function aiSetModel(provider: Provider, model: string) {
  const db = getDb();
  const k =
    provider === 'openai' ? 'ai.openai_model' :
    provider === 'ollama' ? 'ai.ollama_model' :
    'ai.anthropic_model';
  const def =
    provider === 'openai' ? OPENAI_DEFAULT :
    provider === 'ollama' ? OLLAMA_DEFAULT :
    ANTHROPIC_DEFAULT;
  db.settings[k] = model || def;
  save();
  return { ok: true };
}

export function aiClearKey(provider: Provider) {
  const db = getDb();
  const k =
    provider === 'openai' ? 'ai.openai_key' :
    provider === 'ollama' ? 'ai.ollama_url' :
    'ai.anthropic_key';
  delete db.settings[k];
  save();
  return { ok: true };
}
