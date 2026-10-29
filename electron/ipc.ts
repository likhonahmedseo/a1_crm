import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDb, nextId, save, getDbPath, replaceDb } from './db';
import {
  startTracking, pauseTracking, resumeTracking, stopTracking,
  getTrackerStatus, getTodaySession,
} from './tracker';
import { htmlToPdf } from './pdf';
import { renderInvoiceHtml, renderClientReportHtml } from './invoice-template';
import { seoStatus, seoLaunch, seoOpenInBrowser } from './seo';
import {
  aiStatus, aiGenerate, aiTestKey, aiSetKey, aiSetModel, aiClearKey, aiSetProvider,
  aiListOllamaModels, aiGeneratePlan, type Provider,
} from './ai';

const now = () => Date.now();

const AGENCY_KEYS = [
  'agency.name',
  'agency.address',
  'agency.email',
  'agency.phone',
  'agency.website',
  'agency.currency',
  'agency.logo_path',
  'agency.primary_color',
  'agency.invoice_footer',
  'agency.invoice_prefix',
];

function getAgencyInfo() {
  const db = getDb();
  const s = db.settings;
  let logoDataUrl = '';
  const logoPath = s['agency.logo_path'];
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const buf = fs.readFileSync(logoPath);
      const ext = path.extname(logoPath).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      logoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    } catch {}
  }
  return {
    name: s['agency.name'] || 'A1 Technovation',
    address: s['agency.address'] || '',
    email: s['agency.email'] || '',
    phone: s['agency.phone'] || '',
    website: s['agency.website'] || '',
    currency: s['agency.currency'] || 'USD',
    logo_data_url: logoDataUrl,
    primary_color: s['agency.primary_color'] || '#3b6ef5',
    invoice_footer: s['agency.invoice_footer'] || '',
    invoice_prefix: s['agency.invoice_prefix'] || 'INV-',
  };
}

export function registerIpc() {
  // ---------- Clients ----------
  ipcMain.handle('clients:list', () => {
    return [...getDb().clients].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
  });

  ipcMain.handle('clients:get', (_e, id: number) =>
    getDb().clients.find((c) => c.id === id) ?? null
  );

  ipcMain.handle('clients:create', (_e, data: any) => {
    const db = getDb();
    const c = {
      id: nextId('clients'),
      name: data.name,
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      color: data.color ?? '#3b6ef5',
      stage: data.stage ?? 'lead',
      deal_value: data.deal_value ?? 0,
      hourly_rate: Number(data.hourly_rate) || 0,
      // Brand profile
      brand_about: data.brand_about ?? null,
      target_audience: data.target_audience ?? null,
      services: data.services ?? null,
      brand_voice: data.brand_voice ?? null,
      social_goals: data.social_goals ?? null,
      keywords: data.keywords ?? null,
      website: data.website ?? null,
      created_at: now(),
    };
    db.clients.push(c);
    save();
    return { id: c.id };
  });

  ipcMain.handle('clients:update', (_e, id: number, data: any) => {
    const db = getDb();
    const c = db.clients.find((x) => x.id === id);
    if (c) {
      Object.assign(c, {
        name: data.name,
        company: data.company ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        notes: data.notes ?? null,
        color: data.color ?? '#3b6ef5',
        stage: data.stage ?? c.stage ?? 'lead',
        deal_value: data.deal_value ?? c.deal_value ?? 0,
        hourly_rate: Number(data.hourly_rate) || c.hourly_rate || 0,
        // Brand profile
        brand_about: data.brand_about ?? c.brand_about ?? null,
        target_audience: data.target_audience ?? c.target_audience ?? null,
        services: data.services ?? c.services ?? null,
        brand_voice: data.brand_voice ?? c.brand_voice ?? null,
        social_goals: data.social_goals ?? c.social_goals ?? null,
        keywords: data.keywords ?? c.keywords ?? null,
        website: data.website ?? c.website ?? null,
        // Contract
        contract_start: data.contract_start !== undefined ? (data.contract_start ?? null) : (c.contract_start ?? null),
        contract_end: data.contract_end !== undefined ? (data.contract_end ?? null) : (c.contract_end ?? null),
        retainer_amount: data.retainer_amount !== undefined ? (Number(data.retainer_amount) || 0) : (c.retainer_amount || 0),
        auto_renew: data.auto_renew !== undefined ? !!data.auto_renew : !!c.auto_renew,
        time_goal_ms: data.time_goal_ms !== undefined ? (Number(data.time_goal_ms) || 0) : (c.time_goal_ms || 0),
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('clients:setStage', (_e, id: number, stage: string) => {
    const c = getDb().clients.find((x) => x.id === id);
    if (c) {
      c.stage = stage;
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('clients:delete', (_e, id: number) => {
    const db = getDb();
    db.clients = db.clients.filter((c) => c.id !== id);
    db.social_accounts = db.social_accounts.filter((s) => s.client_id !== id);
    db.website_logins = (db.website_logins || []).filter((w: any) => w.client_id !== id);
    db.notes = db.notes.filter((n) => n.client_id !== id);
    db.invoices = db.invoices.filter((i) => i.client_id !== id);
    for (const t of db.tasks) if (t.client_id === id) t.client_id = null;
    for (const te of db.time_entries) if (te.client_id === id) te.client_id = null;
    save();
    return { ok: true };
  });

  // ---------- Social accounts ----------
  ipcMain.handle('social:listForClient', (_e, clientId: number) => {
    return getDb()
      .social_accounts.filter((s) => s.client_id === clientId)
      .sort((a, b) => a.platform.localeCompare(b.platform));
  });

  ipcMain.handle('social:create', (_e, data: any) => {
    const db = getDb();
    const s = {
      id: nextId('social_accounts'),
      client_id: data.client_id,
      platform: data.platform,
      handle: data.handle ?? null,
      url: data.url ?? null,
      username: data.username ?? null,
      notes: data.notes ?? null,
      created_at: now(),
    };
    db.social_accounts.push(s);
    save();
    return { id: s.id };
  });

  ipcMain.handle('social:update', (_e, id: number, data: any) => {
    const s = getDb().social_accounts.find((x) => x.id === id);
    if (s) {
      Object.assign(s, {
        platform: data.platform,
        handle: data.handle ?? null,
        url: data.url ?? null,
        username: data.username ?? null,
        notes: data.notes ?? null,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('social:delete', (_e, id: number) => {
    const db = getDb();
    db.social_accounts = db.social_accounts.filter((s) => s.id !== id);
    save();
    return { ok: true };
  });

  ipcMain.handle('social:open', (_e, url: string) => shell.openExternal(url));

  // ---------- Website logins ----------
  ipcMain.handle('websiteLogins:listForClient', (_e, clientId: number) => {
    return (getDb().website_logins || [])
      .filter((w: any) => w.client_id === clientId)
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  });

  ipcMain.handle('websiteLogins:create', (_e, data: any) => {
    const db = getDb();
    if (!db.website_logins) db.website_logins = [];
    const w = {
      id: nextId('website_logins'),
      client_id: data.client_id,
      label: data.label || 'Website',
      url: data.url ?? null,
      username: data.username ?? null,
      password: data.password ?? null,
      notes: data.notes ?? null,
      created_at: now(),
    };
    db.website_logins.push(w);
    save();
    return { id: w.id };
  });

  ipcMain.handle('websiteLogins:update', (_e, id: number, data: any) => {
    const w = (getDb().website_logins || []).find((x: any) => x.id === id);
    if (w) {
      Object.assign(w, {
        label: data.label || w.label,
        url: data.url ?? null,
        username: data.username ?? null,
        password: data.password ?? null,
        notes: data.notes ?? null,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('websiteLogins:delete', (_e, id: number) => {
    const db = getDb();
    db.website_logins = (db.website_logins || []).filter((w: any) => w.id !== id);
    save();
    return { ok: true };
  });

  ipcMain.handle('websiteLogins:open', (_e, url: string) => shell.openExternal(url));

  // ---------- Notes (activity log) ----------
  ipcMain.handle('notes:listForClient', (_e, clientId: number) => {
    return getDb()
      .notes.filter((n) => n.client_id === clientId)
      .sort((a, b) => b.created_at - a.created_at);
  });

  ipcMain.handle('notes:create', (_e, data: any) => {
    const db = getDb();
    const n = {
      id: nextId('notes'),
      client_id: data.client_id,
      body: data.body,
      created_at: now(),
    };
    db.notes.push(n);
    save();
    return { id: n.id };
  });

  ipcMain.handle('notes:update', (_e, id: number, body: string) => {
    const n = getDb().notes.find((x) => x.id === id);
    if (n) {
      n.body = body;
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('notes:delete', (_e, id: number) => {
    const db = getDb();
    db.notes = db.notes.filter((n) => n.id !== id);
    save();
    return { ok: true };
  });

  // ---------- Tasks ----------
  ipcMain.handle('tasks:list', (_e, filter?: { clientId?: number | null; status?: string }) => {
    const db = getDb();
    const statusOrder: Record<string, number> = { todo: 1, in_progress: 2, done: 3 };
    return db.tasks
      .filter((t) =>
        filter?.clientId !== undefined && filter.clientId !== null
          ? t.client_id === filter.clientId
          : true
      )
      .filter((t) => (filter?.status ? t.status === filter.status : true))
      .map((t) => {
        const c = t.client_id ? db.clients.find((x) => x.id === t.client_id) : null;
        return { ...t, client_name: c?.name ?? null, client_color: c?.color ?? null };
      })
      .sort((a, b) => {
        const so = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
        if (so) return so;
        const ad = a.due_date ?? Number.MAX_SAFE_INTEGER;
        const bd = b.due_date ?? Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return b.created_at - a.created_at;
      });
  });

  ipcMain.handle('tasks:create', (_e, data: any) => {
    const db = getDb();
    const t = {
      id: nextId('tasks'),
      client_id: data.client_id ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
      due_date: data.due_date ?? null,
      recurring: data.recurring ?? 'none',
      created_at: now(),
      completed_at: null as number | null,
    };
    db.tasks.push(t);
    save();
    return { id: t.id };
  });

  ipcMain.handle('tasks:update', (_e, id: number, data: any) => {
    const db = getDb();
    const t = db.tasks.find((x) => x.id === id);
    if (t) {
      const wasNotDone = t.status !== 'done';
      const nowDone = data.status === 'done';
      const completedAt = nowDone ? data.completed_at ?? now() : null;
      Object.assign(t, {
        client_id: data.client_id ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'todo',
        priority: data.priority ?? 'medium',
        due_date: data.due_date ?? null,
        recurring: data.recurring ?? t.recurring ?? 'none',
        completed_at: completedAt,
      });
      // Auto-spawn next occurrence for recurring tasks
      if (wasNotDone && nowDone && t.recurring && t.recurring !== 'none') {
        const nextDue = t.due_date ? new Date(t.due_date) : new Date();
        if (t.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
        else nextDue.setMonth(nextDue.getMonth() + 1);
        db.tasks.push({
          id: nextId('tasks'),
          client_id: t.client_id,
          title: t.title,
          description: t.description,
          status: 'todo',
          priority: t.priority,
          due_date: nextDue.getTime(),
          recurring: t.recurring,
          created_at: now(),
          completed_at: null,
        });
      }
      save();
    }
    return { ok: true };
  });

  // Tasks due today / overdue — used for startup alerts
  ipcMain.handle('tasks:dueAlerts', () => {
    const db = getDb();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    return db.tasks
      .filter((t) => t.status !== 'done' && t.due_date)
      .map((t) => {
        const c = t.client_id ? db.clients.find((x: any) => x.id === t.client_id) : null;
        const isOverdue = t.due_date < todayStart.getTime();
        const isDueToday = t.due_date >= todayStart.getTime() && t.due_date <= todayEnd.getTime();
        return { ...t, client_name: c?.name ?? null, isOverdue, isDueToday };
      })
      .filter((t) => t.isOverdue || t.isDueToday);
  });

  ipcMain.handle('tasks:delete', (_e, id: number) => {
    const db = getDb();
    db.tasks = db.tasks.filter((t) => t.id !== id);
    for (const te of db.time_entries) if (te.task_id === id) te.task_id = null;
    save();
    return { ok: true };
  });

  // ---------- Tracker ----------
  ipcMain.handle('tracker:start', (_e, opts: any) => startTracking(opts || {}));
  ipcMain.handle('tracker:pause', () => pauseTracking());
  ipcMain.handle('tracker:resume', () => resumeTracking());
  ipcMain.handle('tracker:stop', () => stopTracking());
  ipcMain.handle('tracker:status', () => getTrackerStatus());
  ipcMain.handle('tracker:todaySession', (_e, clientId: number | null) =>
    getTodaySession(clientId)
  );

  ipcMain.handle('tracker:entries', (_e, filter?: { clientId?: number | null; date?: string }) => {
    const db = getDb();
    return db.time_entries
      .filter((e) => {
        if (filter?.clientId !== undefined && filter.clientId !== null) {
          if (e.client_id !== filter.clientId) return false;
        }
        if (filter?.date) {
          if (e.date !== filter.date) return false;
        }
        return true;
      })
      .map((e) => {
        const c = e.client_id ? db.clients.find((x) => x.id === e.client_id) : null;
        const t = e.task_id ? db.tasks.find((x) => x.id === e.task_id) : null;
        return { ...e, client_name: c?.name ?? null, task_title: t?.title ?? null };
      })
      .sort((a, b) => b.started_at - a.started_at)
      .slice(0, 200);
  });

  ipcMain.handle('tracker:screenshots', (_e, entryId: number) => {
    return getDb()
      .screenshots.filter((s) => s.time_entry_id === entryId)
      .sort((a, b) => b.taken_at - a.taken_at);
  });

  ipcMain.handle('tracker:readScreenshot', (_e, filePath: string) => {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  });

  ipcMain.handle('tracker:openScreenshotsDir', () => {
    const dir = path.join(app.getPath('userData'), 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  // ---------- Invoices ----------
  ipcMain.handle('invoices:list', (_e, filter?: { clientId?: number | null }) => {
    const db = getDb();
    return db.invoices
      .filter((i) =>
        filter?.clientId !== undefined && filter.clientId !== null
          ? i.client_id === filter.clientId
          : true
      )
      .map((i) => {
        const c = i.client_id ? db.clients.find((x) => x.id === i.client_id) : null;
        const subtotal = (i.items || []).reduce(
          (s: number, it: any) => s + (it.quantity || 0) * (it.unit_price || 0),
          0
        );
        const taxAmt = (subtotal - (i.discount || 0)) * ((i.tax_rate || 0) / 100);
        const total = subtotal - (i.discount || 0) + taxAmt;
        return { ...i, client_name: c?.name ?? null, client_company: c?.company ?? null, total };
      })
      .sort((a, b) => b.created_at - a.created_at);
  });

  ipcMain.handle('invoices:get', (_e, id: number) => {
    const db = getDb();
    const i = db.invoices.find((x) => x.id === id);
    if (!i) return null;
    const c = i.client_id ? db.clients.find((x) => x.id === i.client_id) : null;
    return { ...i, client: c };
  });

  ipcMain.handle('invoices:nextNumber', () => {
    const db = getDb();
    const prefix = db.settings['agency.invoice_prefix'] || 'INV-';
    const year = new Date().getFullYear();
    const count = db.invoices.filter((i) =>
      String(i.number).includes(`${prefix}${year}`)
    ).length;
    return `${prefix}${year}-${String(count + 1).padStart(4, '0')}`;
  });

  ipcMain.handle('invoices:create', (_e, data: any) => {
    const db = getDb();
    const inv = {
      id: nextId('invoices'),
      client_id: data.client_id ?? null,
      number: data.number,
      issue_date: data.issue_date ?? now(),
      due_date: data.due_date ?? null,
      status: data.status ?? 'draft',
      notes: data.notes ?? null,
      items: data.items ?? [],
      tax_rate: Number(data.tax_rate) || 0,
      discount: Number(data.discount) || 0,
      created_at: now(),
      paid_at: null as number | null,
    };
    db.invoices.push(inv);
    save();
    return { id: inv.id };
  });

  ipcMain.handle('invoices:update', (_e, id: number, data: any) => {
    const inv = getDb().invoices.find((x) => x.id === id);
    if (inv) {
      Object.assign(inv, {
        client_id: data.client_id ?? null,
        number: data.number,
        issue_date: data.issue_date ?? inv.issue_date,
        due_date: data.due_date ?? null,
        status: data.status ?? inv.status,
        notes: data.notes ?? null,
        items: data.items ?? [],
        tax_rate: Number(data.tax_rate) || 0,
        discount: Number(data.discount) || 0,
        paid_at: data.status === 'paid' ? data.paid_at ?? inv.paid_at ?? now() : null,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('invoices:delete', (_e, id: number) => {
    const db = getDb();
    db.invoices = db.invoices.filter((i) => i.id !== id);
    save();
    return { ok: true };
  });

  ipcMain.handle('invoices:renderHtml', (_e, id: number | null, sample = false) => {
    const db = getDb();
    const agency = getAgencyInfo();
    let invoice: any;
    let client: any = null;
    if (sample || !id) {
      invoice = sampleInvoice();
      client = invoice.client;
    } else {
      invoice = db.invoices.find((x) => x.id === id);
      if (!invoice) return '';
      client = invoice.client_id ? db.clients.find((c) => c.id === invoice.client_id) : null;
    }
    return renderInvoiceHtml({ ...invoice, client }, agency);
  });

  ipcMain.handle('invoices:exportPdf', async (_e, id: number) => {
    const db = getDb();
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return { ok: false, error: 'Invoice not found' };
    const client = inv.client_id ? db.clients.find((c) => c.id === inv.client_id) : null;
    const html = renderInvoiceHtml({ ...inv, client }, getAgencyInfo());
    return await htmlToPdf(html, `Invoice-${inv.number}.pdf`);
  });

  ipcMain.handle('invoices:exportSamplePdf', async () => {
    const html = renderInvoiceHtml(sampleInvoice(), getAgencyInfo());
    return await htmlToPdf(html, `Sample-Invoice.pdf`);
  });

  // ---------- Client Report ----------
  ipcMain.handle('reports:clientHtml', (_e, clientId: number) => {
    const db = getDb();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) return '';
    const tasks = db.tasks.filter((t) => t.client_id === clientId);
    const entries = db.time_entries.filter((e) => e.client_id === clientId);
    const invoices = db.invoices.filter((i) => i.client_id === clientId);
    const notes = db.notes
      .filter((n) => n.client_id === clientId)
      .sort((a, b) => b.created_at - a.created_at);
    const totalTrackedMs = entries.reduce((s, e) => s + (e.duration_ms || 0), 0);
    return renderClientReportHtml({ client, tasks, entries, invoices, notes, agency: getAgencyInfo(), totalTrackedMs });
  });

  ipcMain.handle('reports:clientPdf', async (_e, clientId: number) => {
    const db = getDb();
    const client = db.clients.find((c) => c.id === clientId);
    if (!client) return { ok: false };
    const tasks = db.tasks.filter((t) => t.client_id === clientId);
    const entries = db.time_entries.filter((e) => e.client_id === clientId);
    const invoices = db.invoices.filter((i) => i.client_id === clientId);
    const notes = db.notes
      .filter((n) => n.client_id === clientId)
      .sort((a, b) => b.created_at - a.created_at);
    const totalTrackedMs = entries.reduce((s, e) => s + (e.duration_ms || 0), 0);
    const html = renderClientReportHtml({
      client,
      tasks,
      entries,
      invoices,
      notes,
      agency: getAgencyInfo(),
      totalTrackedMs,
    });
    return await htmlToPdf(html, `Client-Report-${client.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`);
  });

  // ---------- Agency / White-label ----------
  ipcMain.handle('agency:get', () => getAgencyInfo());

  ipcMain.handle('agency:set', (_e, payload: Record<string, string>) => {
    const db = getDb();
    for (const k of Object.keys(payload)) {
      if (AGENCY_KEYS.includes(k)) db.settings[k] = payload[k] ?? '';
    }
    save();
    return { ok: true };
  });

  ipcMain.handle('agency:uploadLogo', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose logo',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    const src = result.filePaths[0];
    const dir = path.join(app.getPath('userData'), 'branding');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(src);
    const dest = path.join(dir, `logo${ext}`);
    fs.copyFileSync(src, dest);
    const db = getDb();
    db.settings['agency.logo_path'] = dest;
    save();
    return { ok: true, path: dest };
  });

  ipcMain.handle('agency:clearLogo', () => {
    const db = getDb();
    delete db.settings['agency.logo_path'];
    save();
    return { ok: true };
  });

  // ---------- Settings (generic) ----------
  ipcMain.handle('settings:get', (_e, key: string) => getDb().settings[key] ?? null);
  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    getDb().settings[key] = value;
    save();
    return { ok: true };
  });

  // ---------- Stats / Reports ----------
  ipcMain.handle('stats:dashboard', (_e, clientId?: number | null) => {
    const db = getDb();
    const hasClient = clientId !== undefined && clientId !== null;
    const matches = (cid: number | null) => (hasClient ? cid === clientId : true);
    const totalClients = db.clients.length;
    const openTasks = db.tasks.filter((t) => matches(t.client_id) && t.status !== 'done').length;
    const doneTasks = db.tasks.filter((t) => matches(t.client_id) && t.status === 'done').length;
    const trackedMs = db.time_entries
      .filter((e) => matches(e.client_id) && e.ended_at)
      .reduce((sum, e) => sum + (e.duration_ms || 0), 0);
    return { totalClients, openTasks, doneTasks, trackedMs };
  });

  ipcMain.handle('stats:revenueByMonth', () => {
    const db = getDb();
    const buckets: Record<string, { paid: number; outstanding: number }> = {};
    for (const i of db.invoices) {
      const d = new Date(i.issue_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const subtotal = (i.items || []).reduce(
        (s: number, it: any) => s + (it.quantity || 0) * (it.unit_price || 0),
        0
      );
      const total = subtotal - (i.discount || 0) + (subtotal - (i.discount || 0)) * ((i.tax_rate || 0) / 100);
      if (!buckets[key]) buckets[key] = { paid: 0, outstanding: 0 };
      if (i.status === 'paid') buckets[key].paid += total;
      else if (i.status !== 'draft') buckets[key].outstanding += total;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v }));
  });

  ipcMain.handle('stats:timeByClient', () => {
    const db = getDb();
    const map: Record<number, number> = {};
    for (const e of db.time_entries) {
      if (!e.client_id || !e.duration_ms) continue;
      map[e.client_id] = (map[e.client_id] || 0) + e.duration_ms;
    }
    return Object.entries(map)
      .map(([cid, ms]) => {
        const c = db.clients.find((x) => x.id === Number(cid));
        return { client_id: Number(cid), name: c?.name || 'Unknown', color: c?.color || '#94a3b8', ms };
      })
      .sort((a, b) => b.ms - a.ms);
  });

  ipcMain.handle('stats:overdueInvoices', () => {
    const db = getDb();
    const today = Date.now();
    return db.invoices
      .filter((i: any) => (i.status === 'sent' || i.status === 'overdue') && i.due_date && i.due_date < today)
      .map((i: any) => {
        const c = i.client_id ? db.clients.find((x: any) => x.id === i.client_id) : null;
        const sub = (i.items || []).reduce((s: number, it: any) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
        const total = sub - (i.discount || 0) + (sub - (i.discount || 0)) * ((i.tax_rate || 0) / 100);
        return { ...i, client_name: c?.name ?? null, total };
      })
      .sort((a: any, b: any) => a.due_date - b.due_date);
  });

  ipcMain.handle('stats:contractAlerts', () => {
    const db = getDb();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return db.clients
      .filter((c: any) => c.contract_end && c.contract_end > now && c.contract_end < now + thirtyDays)
      .map((c: any) => ({
        id: c.id, name: c.name, contract_end: c.contract_end,
        daysLeft: Math.ceil((c.contract_end - now) / (24 * 60 * 60 * 1000)),
        auto_renew: c.auto_renew,
      }));
  });

  ipcMain.handle('stats:pipelineValue', () => {
    const db = getDb();
    const stages: Record<string, { count: number; value: number }> = {};
    for (const c of db.clients) {
      const stage = c.stage || 'lead';
      if (!stages[stage]) stages[stage] = { count: 0, value: 0 };
      stages[stage].count++;
      stages[stage].value += Number(c.deal_value) || 0;
    }
    return stages;
  });

  // ---------- Backup / Restore ----------
  ipcMain.handle('backup:export', async () => {
    const db = getDb();
    const result = await dialog.showSaveDialog({
      title: 'Export backup',
      defaultPath: path.join(
        app.getPath('documents'),
        `a1crm-backup-${new Date().toISOString().slice(0, 10)}.json`
      ),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, JSON.stringify(db, null, 2));
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      cancelId: 0,
      message: 'Restore will replace ALL current data with the backup. Continue?',
    });
    if (confirmed.response !== 1) return { ok: false };
    try {
      const payload = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      replaceDb(payload);
      // Reload windows so renderer picks up new state
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.reload());
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:openDataFolder', () => {
    shell.openPath(path.dirname(getDbPath()));
  });

  // ---------- App window / tray ----------
  ipcMain.handle('app:getRunInBackground', () => {
    return getDb().settings['app.runInBackground'] === 'true';
  });

  ipcMain.handle('app:setRunInBackground', (_e, value: boolean) => {
    getDb().settings['app.runInBackground'] = value ? 'true' : 'false';
    save();
    // Refresh tray menu so it reflects new setting
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) {
      const { refreshTray } = require('./tray');
      refreshTray(wins[0]);
    }
    return { ok: true };
  });

  ipcMain.handle('app:refreshTray', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) {
      const { refreshTray } = require('./tray');
      refreshTray(wins[0]);
    }
    return { ok: true };
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());

  // ---------- Expenses ----------
  ipcMain.handle('expenses:list', (_e, filter?: { clientId?: number | null; month?: string }) => {
    const db = getDb();
    return (db.expenses || [])
      .filter((e: any) => {
        if (filter?.clientId !== undefined && filter.clientId !== null) {
          if (e.client_id !== filter.clientId) return false;
        }
        if (filter?.month && !e.date?.startsWith(filter.month)) return false;
        return true;
      })
      .map((e: any) => {
        const c = e.client_id ? db.clients.find((x: any) => x.id === e.client_id) : null;
        return { ...e, client_name: c?.name ?? null };
      })
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
  });

  ipcMain.handle('expenses:create', (_e, data: any) => {
    const db = getDb();
    if (!db.expenses) db.expenses = [];
    const e = {
      id: nextId('expenses'),
      client_id: data.client_id ?? null,
      date: data.date || new Date().toISOString().slice(0, 10),
      category: data.category || 'other',
      description: data.description || '',
      amount: Number(data.amount) || 0,
      billable: !!data.billable,
      receipt_note: data.receipt_note ?? null,
      created_at: now(),
    };
    db.expenses.push(e);
    save();
    return { id: e.id };
  });

  ipcMain.handle('expenses:update', (_e, id: number, data: any) => {
    const e = (getDb().expenses || []).find((x: any) => x.id === id);
    if (e) {
      Object.assign(e, {
        client_id: data.client_id ?? null,
        date: data.date || e.date,
        category: data.category || e.category,
        description: data.description || e.description,
        amount: Number(data.amount) || 0,
        billable: !!data.billable,
        receipt_note: data.receipt_note ?? null,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('expenses:delete', (_e, id: number) => {
    const db = getDb();
    db.expenses = (db.expenses || []).filter((e: any) => e.id !== id);
    save();
    return { ok: true };
  });

  ipcMain.handle('expenses:exportCsv', async (_e, filter?: { clientId?: number | null }) => {
    const db = getDb();
    const expenses = (db.expenses || [])
      .filter((e: any) => filter?.clientId ? e.client_id === filter.clientId : true)
      .map((e: any) => {
        const c = e.client_id ? db.clients.find((x: any) => x.id === e.client_id) : null;
        return { ...e, client_name: c?.name ?? '' };
      })
      .sort((a: any, b: any) => b.date.localeCompare(a.date));

    const rows = [
      ['Date', 'Client', 'Category', 'Description', 'Amount', 'Billable', 'Note'],
      ...expenses.map((e: any) => [
        e.date, e.client_name, e.category, e.description,
        e.amount.toFixed(2), e.billable ? 'Yes' : 'No', e.receipt_note || '',
      ]),
    ].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const result = await dialog.showSaveDialog({
      title: 'Export expenses',
      defaultPath: path.join(app.getPath('documents'), `expenses-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, rows);
    return { ok: true, filePath: result.filePath };
  });

  // ---------- Proposals ----------
  function calcProposalTotal(items: any[], discount: number, taxRate: number) {
    const sub = (items || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
    const tax = (sub - discount) * (taxRate / 100);
    return sub - discount + tax;
  }

  ipcMain.handle('proposals:list', (_e, filter?: { clientId?: number | null }) => {
    const db = getDb();
    return (db.proposals || [])
      .filter((p: any) => filter?.clientId !== undefined && filter.clientId !== null ? p.client_id === filter.clientId : true)
      .map((p: any) => {
        const c = p.client_id ? db.clients.find((x: any) => x.id === p.client_id) : null;
        return { ...p, client_name: c?.name ?? null, client_company: c?.company ?? null, total: calcProposalTotal(p.items, p.discount || 0, p.tax_rate || 0) };
      })
      .sort((a: any, b: any) => b.created_at - a.created_at);
  });

  ipcMain.handle('proposals:get', (_e, id: number) => {
    const db = getDb();
    const p = (db.proposals || []).find((x: any) => x.id === id);
    if (!p) return null;
    const c = p.client_id ? db.clients.find((x: any) => x.id === p.client_id) : null;
    return { ...p, client: c };
  });

  ipcMain.handle('proposals:nextNumber', () => {
    const db = getDb();
    const year = new Date().getFullYear();
    const count = (db.proposals || []).filter((p: any) => String(p.number).includes(`PROP-${year}`)).length;
    return `PROP-${year}-${String(count + 1).padStart(4, '0')}`;
  });

  ipcMain.handle('proposals:create', (_e, data: any) => {
    const db = getDb();
    if (!db.proposals) db.proposals = [];
    const p = {
      id: nextId('proposals'),
      client_id: data.client_id ?? null,
      number: data.number,
      issue_date: data.issue_date ?? now(),
      valid_until: data.valid_until ?? null,
      status: data.status ?? 'draft',
      notes: data.notes ?? null,
      items: data.items ?? [],
      tax_rate: Number(data.tax_rate) || 0,
      discount: Number(data.discount) || 0,
      created_at: now(),
      converted_invoice_id: null as number | null,
    };
    db.proposals.push(p);
    save();
    return { id: p.id };
  });

  ipcMain.handle('proposals:update', (_e, id: number, data: any) => {
    const p = (getDb().proposals || []).find((x: any) => x.id === id);
    if (p) {
      Object.assign(p, {
        client_id: data.client_id ?? null,
        number: data.number,
        issue_date: data.issue_date ?? p.issue_date,
        valid_until: data.valid_until ?? null,
        status: data.status ?? p.status,
        notes: data.notes ?? null,
        items: data.items ?? [],
        tax_rate: Number(data.tax_rate) || 0,
        discount: Number(data.discount) || 0,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('proposals:delete', (_e, id: number) => {
    const db = getDb();
    db.proposals = (db.proposals || []).filter((p: any) => p.id !== id);
    save();
    return { ok: true };
  });

  ipcMain.handle('proposals:exportPdf', async (_e, id: number) => {
    const db = getDb();
    const p = (db.proposals || []).find((x: any) => x.id === id);
    if (!p) return { ok: false, error: 'Not found' };
    const client = p.client_id ? db.clients.find((c: any) => c.id === p.client_id) : null;
    const agency = getAgencyInfo();
    // Reuse invoice HTML template — just relabels "Invoice" → "Proposal"
    const html = renderInvoiceHtml(
      { ...p, number: p.number, due_date: p.valid_until, client },
      { ...agency, invoice_footer: `Valid until: ${p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '—'}. ${agency.invoice_footer}` }
    );
    return await htmlToPdf(html, `Proposal-${p.number}.pdf`);
  });

  ipcMain.handle('proposals:convertToInvoice', (_e, id: number) => {
    const db = getDb();
    const p = (db.proposals || []).find((x: any) => x.id === id);
    if (!p) return { ok: false, error: 'Proposal not found' };
    if (p.converted_invoice_id) return { ok: false, error: 'Already converted' };

    const prefix = db.settings['agency.invoice_prefix'] || 'INV-';
    const year = new Date().getFullYear();
    const count = db.invoices.filter((i: any) => String(i.number).includes(`${prefix}${year}`)).length;
    const number = `${prefix}${year}-${String(count + 1).padStart(4, '0')}`;

    const inv = {
      id: nextId('invoices'),
      client_id: p.client_id,
      number,
      issue_date: now(),
      due_date: now() + 14 * 24 * 60 * 60 * 1000,
      status: 'draft',
      notes: p.notes,
      items: p.items,
      tax_rate: p.tax_rate,
      discount: p.discount,
      created_at: now(),
      paid_at: null,
    };
    db.invoices.push(inv);
    p.status = 'accepted';
    p.converted_invoice_id = inv.id;
    save();
    return { ok: true, invoiceId: inv.id };
  });

  // ---------- Checklists ----------
  ipcMain.handle('checklists:listForClient', (_e, clientId: number) => {
    return (getDb().checklists || [])
      .filter((c: any) => c.client_id === clientId)
      .sort((a: any, b: any) => a.order - b.order);
  });

  ipcMain.handle('checklists:create', (_e, data: any) => {
    const db = getDb();
    if (!db.checklists) db.checklists = [];
    const maxOrder = Math.max(0, ...(db.checklists.filter((c: any) => c.client_id === data.client_id).map((c: any) => c.order)));
    const item = {
      id: nextId('checklists'),
      client_id: data.client_id,
      title: data.title,
      done: false,
      order: maxOrder + 1,
      created_at: now(),
    };
    db.checklists.push(item);
    save();
    return { id: item.id };
  });

  ipcMain.handle('checklists:toggle', (_e, id: number) => {
    const item = (getDb().checklists || []).find((c: any) => c.id === id);
    if (item) { item.done = !item.done; save(); }
    return { ok: true };
  });

  ipcMain.handle('checklists:delete', (_e, id: number) => {
    const db = getDb();
    db.checklists = (db.checklists || []).filter((c: any) => c.id !== id);
    save();
    return { ok: true };
  });

  // ---------- Client contract / retainer fields ----------
  ipcMain.handle('clients:setContract', (_e, id: number, data: any) => {
    const c = getDb().clients.find((x: any) => x.id === id);
    if (c) {
      Object.assign(c, {
        contract_start: data.contract_start ?? null,
        contract_end: data.contract_end ?? null,
        retainer_amount: Number(data.retainer_amount) || 0,
        auto_renew: !!data.auto_renew,
        time_goal_ms: Number(data.time_goal_ms) || 0,
      });
      save();
    }
    return { ok: true };
  });

  // ---------- CSV Exports ----------
  async function showCsvSaveDialog(defaultName: string) {
    const result = await dialog.showSaveDialog({
      title: 'Export CSV',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    return result.canceled ? null : result.filePath!;
  }

  function tocsv(rows: string[][]): string {
    return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  ipcMain.handle('exports:invoicesCsv', async (_e, filter?: { clientId?: number | null }) => {
    const db = getDb();
    const rows = db.invoices
      .filter((i: any) => filter?.clientId ? i.client_id === filter.clientId : true)
      .map((i: any) => {
        const c = i.client_id ? db.clients.find((x: any) => x.id === i.client_id) : null;
        const sub = (i.items || []).reduce((s: number, it: any) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
        const total = sub - (i.discount || 0) + (sub - (i.discount || 0)) * ((i.tax_rate || 0) / 100);
        return [i.number, c?.name ?? '', new Date(i.issue_date).toLocaleDateString(), i.status, total.toFixed(2)];
      });
    const filePath = await showCsvSaveDialog(`invoices-${new Date().toISOString().slice(0, 10)}.csv`);
    if (!filePath) return { ok: false };
    fs.writeFileSync(filePath, tocsv([['Number', 'Client', 'Date', 'Status', 'Total'], ...rows]));
    return { ok: true, filePath };
  });

  ipcMain.handle('exports:timeEntriesCsv', async (_e, filter?: { clientId?: number | null }) => {
    const db = getDb();
    const rows = db.time_entries
      .filter((e: any) => filter?.clientId ? e.client_id === filter.clientId : true)
      .map((e: any) => {
        const c = e.client_id ? db.clients.find((x: any) => x.id === e.client_id) : null;
        const hrs = ((e.duration_ms || e.accumulated_ms || 0) / 3600000).toFixed(2);
        return [e.date || '', c?.name ?? '', e.description || '', hrs, e.status || ''];
      });
    const filePath = await showCsvSaveDialog(`time-entries-${new Date().toISOString().slice(0, 10)}.csv`);
    if (!filePath) return { ok: false };
    fs.writeFileSync(filePath, tocsv([['Date', 'Client', 'Description', 'Hours', 'Status'], ...rows]));
    return { ok: true, filePath };
  });

  ipcMain.handle('exports:clientsCsv', async () => {
    const db = getDb();
    const rows = db.clients.map((c: any) => [
      c.name, c.company ?? '', c.email ?? '', c.phone ?? '', c.stage, c.deal_value, c.hourly_rate,
    ]);
    const filePath = await showCsvSaveDialog(`clients-${new Date().toISOString().slice(0, 10)}.csv`);
    if (!filePath) return { ok: false };
    fs.writeFileSync(filePath, tocsv([['Name', 'Company', 'Email', 'Phone', 'Stage', 'Deal Value', 'Hourly Rate'], ...rows]));
    return { ok: true, filePath };
  });

  // ---------- AI ----------
  ipcMain.handle('ai:status', () => aiStatus());
  ipcMain.handle('ai:setProvider', (_e, p: Provider) => aiSetProvider(p));
  ipcMain.handle('ai:setKey', (_e, p: Provider, key: string) => aiSetKey(p, key));
  ipcMain.handle('ai:clearKey', (_e, p: Provider) => aiClearKey(p));
  ipcMain.handle('ai:setModel', (_e, p: Provider, model: string) => aiSetModel(p, model));
  ipcMain.handle('ai:testKey', (_e, p: Provider, key: string) => aiTestKey(p, key));
  ipcMain.handle('ai:listOllamaModels', (_e, url?: string) => aiListOllamaModels(url));
  ipcMain.handle('ai:generatePlan', async (e, opts: any) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    return aiGeneratePlan(opts, win);
  });
  ipcMain.handle('ai:generate', async (e, opts: any, requestId: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    return aiGenerate(opts, requestId, win);
  });

  // ---------- Invoice from time entries ----------
  ipcMain.handle('invoices:fromTimeEntries', (_e, opts: { clientId: number; entryIds: number[]; hourlyRate: number }) => {
    const db = getDb();
    const client = db.clients.find((c) => c.id === opts.clientId);
    const entries = db.time_entries.filter((e) => opts.entryIds.includes(e.id));
    if (!entries.length) return { ok: false, error: 'No entries selected' };

    const dateSet = [...new Set(entries.map((e) => e.date || new Date(e.started_at).toISOString().slice(0, 10)))].sort();
    const dateLabel = dateSet.length === 1 ? dateSet[0] : `${dateSet[0]} – ${dateSet[dateSet.length - 1]}`;
    const items = entries.map((e) => {
      const hrs = ((e.duration_ms || e.accumulated_ms || 0) / 3600000);
      return {
        description: `${e.description || e.date || 'Time tracked'} (${hrs.toFixed(2)} hrs)`,
        quantity: parseFloat(hrs.toFixed(2)),
        unit_price: opts.hourlyRate,
      };
    });

    const prefix = db.settings['agency.invoice_prefix'] || 'INV-';
    const year = new Date().getFullYear();
    const count = db.invoices.filter((i: any) => String(i.number).includes(`${prefix}${year}`)).length;
    const number = `${prefix}${year}-${String(count + 1).padStart(4, '0')}`;

    const inv = {
      id: nextId('invoices'),
      client_id: opts.clientId,
      number,
      issue_date: now(),
      due_date: now() + 14 * 24 * 60 * 60 * 1000,
      status: 'draft',
      notes: `Time tracking period: ${dateLabel}`,
      items,
      tax_rate: 0,
      discount: 0,
      created_at: now(),
      paid_at: null,
    };
    db.invoices.push(inv);
    save();
    return { ok: true, invoiceId: inv.id, number };
  });

  // ---------- Content calendar ----------
  ipcMain.handle('content:list', (_e, filter?: { clientId?: number | null; month?: string }) => {
    const db = getDb();
    return (db.content_items || [])
      .filter((c: any) => {
        if (filter?.clientId !== undefined && filter.clientId !== null) {
          if (c.client_id !== filter.clientId) return false;
        }
        if (filter?.month && !c.scheduled_date?.startsWith(filter.month)) return false;
        return true;
      })
      .map((c: any) => {
        const client = c.client_id ? db.clients.find((x: any) => x.id === c.client_id) : null;
        return { ...c, client_name: client?.name ?? null };
      })
      .sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date));
  });

  ipcMain.handle('content:create', (_e, data: any) => {
    const db = getDb();
    if (!db.content_items) db.content_items = [];
    const item = {
      id: nextId('content_items'),
      client_id: data.client_id ?? null,
      platform: data.platform ?? null,
      type: data.type ?? 'custom',
      content: data.content,
      scheduled_date: data.scheduled_date,
      status: data.status ?? 'draft',
      created_at: now(),
    };
    db.content_items.push(item);
    save();
    return { id: item.id };
  });

  ipcMain.handle('content:update', (_e, id: number, data: any) => {
    const db = getDb();
    const item = (db.content_items || []).find((x: any) => x.id === id);
    if (item) {
      Object.assign(item, {
        client_id: data.client_id ?? null,
        platform: data.platform ?? null,
        content: data.content,
        scheduled_date: data.scheduled_date,
        status: data.status ?? item.status,
      });
      save();
    }
    return { ok: true };
  });

  ipcMain.handle('content:delete', (_e, id: number) => {
    const db = getDb();
    db.content_items = (db.content_items || []).filter((x: any) => x.id !== id);
    save();
    return { ok: true };
  });

  // ---------- Weekly time report PDF ----------
  ipcMain.handle('reports:weeklyPdf', async (_e, opts: { clientId?: number | null; weekStart: string }) => {
    const db = getDb();
    const agency = getAgencyInfo();
    // weekStart is YYYY-MM-DD (Monday)
    const start = new Date(opts.weekStart); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 7);

    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }

    const entries = db.time_entries.filter((e: any) => {
      const eDate = e.date || new Date(e.started_at).toISOString().slice(0, 10);
      if (!days.includes(eDate)) return false;
      if (opts.clientId) return e.client_id === opts.clientId;
      return true;
    });

    const client = opts.clientId ? db.clients.find((c: any) => c.id === opts.clientId) : null;

    type DayEntry = { date: string; entries: any[]; totalMs: number };
    const byDay: Record<string, DayEntry> = {};
    for (const day of days) {
      byDay[day] = { date: day, entries: [], totalMs: 0 };
    }
    for (const e of entries) {
      const key = e.date || new Date(e.started_at).toISOString().slice(0, 10);
      if (byDay[key]) {
        const c = e.client_id ? db.clients.find((x: any) => x.id === e.client_id) : null;
        byDay[key].entries.push({ ...e, client_name: c?.name ?? null });
        byDay[key].totalMs += e.duration_ms || e.accumulated_ms || 0;
      }
    }

    const totalMs = entries.reduce((s: number, e: any) => s + (e.duration_ms || e.accumulated_ms || 0), 0);

    function fmtDur(ms: number) {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    function fmtDay(d: string) {
      const [y, mo, da] = d.split('-').map(Number);
      return new Date(y, mo - 1, da).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    const color = agency.primary_color || '#3b6ef5';
    const rows = days.map((day) => {
      const d = byDay[day];
      if (!d.entries.length) return `<tr><td style="padding:8px 12px;color:#94a3b8;">${fmtDay(day)}</td><td colspan="3" style="padding:8px 12px;color:#94a3b8;font-style:italic;">No sessions</td></tr>`;
      return d.entries.map((e, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          ${i === 0 ? `<td style="padding:8px 12px;font-weight:600;vertical-align:top;" rowspan="${d.entries.length}">${fmtDay(day)}<br><span style="font-size:11px;color:#64748b;">${fmtDur(d.totalMs)}</span></td>` : ''}
          <td style="padding:6px 12px;">${e.client_name || '—'}</td>
          <td style="padding:6px 12px;">${e.description || '—'}</td>
          <td style="padding:6px 12px;font-family:monospace;text-align:right;">${fmtDur(e.duration_ms || e.accumulated_ms || 0)}</td>
        </tr>`).join('');
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;margin:0;padding:40px;}
      h1{font-size:22px;margin-bottom:4px;color:${color};}
      .meta{color:#64748b;font-size:13px;margin-bottom:24px;}
      .summary{display:flex;gap:16px;margin-bottom:24px;}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;min-width:140px;}
      .card .label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;}
      .card .val{font-size:22px;font-weight:700;margin-top:4px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:${color};color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;}
      tr:last-child td{border-bottom:none;}
      td{border-bottom:1px solid #f1f5f9;}
      .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;}
    </style></head><body>
      <h1>Weekly Time Report</h1>
      <div class="meta">
        ${client ? `Client: <strong>${client.name}</strong> &nbsp;|&nbsp; ` : ''}
        Period: <strong>${fmtDay(days[0])} – ${fmtDay(days[6])}</strong>
        &nbsp;|&nbsp; Generated by ${agency.name}
      </div>
      <div class="summary">
        <div class="card"><div class="label">Total hours</div><div class="val" style="color:${color};">${fmtDur(totalMs)}</div></div>
        <div class="card"><div class="label">Sessions</div><div class="val">${entries.length}</div></div>
        <div class="card"><div class="label">Active days</div><div class="val">${days.filter((d) => byDay[d].entries.length).length}</div></div>
      </div>
      <table>
        <thead><tr><th>Day</th><th>Client</th><th>Description</th><th style="text-align:right;">Duration</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Generated by ${agency.name} &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
    </body></html>`;

    const filename = `Weekly-Report-${opts.weekStart}.pdf`;
    return await htmlToPdf(html, filename);
  });

  // ---------- SEO Dynamics ----------
  ipcMain.handle('seo:status', (_e, p?: string) => seoStatus(p));
  ipcMain.handle('seo:launch', (_e, p?: string) => seoLaunch(p));
  ipcMain.handle('seo:openInBrowser', () => seoOpenInBrowser());
  ipcMain.handle('seo:setPath', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Locate A1 SEO Dynamics folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false };
    getDb().settings['seo.path'] = result.filePaths[0];
    save();
    return { ok: true, path: result.filePaths[0] };
  });
}

function sampleInvoice() {
  return {
    number: 'INV-SAMPLE-0001',
    issue_date: Date.now(),
    due_date: Date.now() + 14 * 24 * 60 * 60 * 1000,
    status: 'draft',
    notes: 'Payment due within 14 days. Thank you for your business!',
    items: [
      { description: 'Social media management — Monthly retainer', quantity: 1, unit_price: 800 },
      { description: 'Content design (Instagram + Facebook posts)', quantity: 12, unit_price: 25 },
      { description: 'Ad campaign setup & monitoring', quantity: 1, unit_price: 250 },
    ],
    tax_rate: 5,
    discount: 50,
    client: {
      name: 'Sample Client',
      company: 'Acme Co.',
      email: 'client@example.com',
      phone: '+1 555 0100',
    },
  };
}
