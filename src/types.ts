export type PipelineStage = 'lead' | 'contacted' | 'proposal' | 'won' | 'lost';

export interface Client {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  color: string;
  stage: PipelineStage;
  deal_value: number;
  hourly_rate: number;
  created_at: number;

  // ── Brand profile (used by AI writer) ──
  /** What the brand does — products, services, mission */
  brand_about: string | null;
  /** Who they're targeting — demographics, interests, pain points */
  target_audience: string | null;
  /** Main services or products offered */
  services: string | null;
  /** Brand tone and personality — e.g. "fun and relatable, never corporate" */
  brand_voice: string | null;
  /** Social media goals — e.g. "grow Instagram following, drive website traffic" */
  social_goals: string | null;
  /** Keywords, hashtags, or phrases to always include */
  keywords: string | null;
  /** Client's website URL */
  website: string | null;

  // ── Contract / retainer ──
  contract_start: number | null;
  contract_end: number | null;
  retainer_amount: number;
  auto_renew: boolean;
  /** Monthly tracked-time goal in milliseconds */
  time_goal_ms: number;
}

export type ExpenseCategory = 'tools' | 'ads' | 'freelancer' | 'travel' | 'office' | 'other';

export interface Expense {
  id: number;
  client_id: number | null;
  client_name?: string | null;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  billable: boolean;
  receipt_note: string | null;
  created_at: number;
}

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface Proposal {
  id: number;
  client_id: number | null;
  client_name?: string | null;
  client_company?: string | null;
  number: string;
  issue_date: number;
  valid_until: number | null;
  status: ProposalStatus;
  notes: string | null;
  items: InvoiceItem[];
  tax_rate: number;
  discount: number;
  total?: number;
  created_at: number;
  converted_invoice_id: number | null;
}

export interface ChecklistItem {
  id: number;
  client_id: number;
  title: string;
  done: boolean;
  order: number;
  created_at: number;
}

export interface SocialAccount {
  id: number;
  client_id: number;
  platform: string;
  handle: string | null;
  url: string | null;
  username: string | null;
  notes: string | null;
  created_at: number;
}

export interface WebsiteLogin {
  id: number;
  client_id: number;
  /** Friendly label, e.g. "WordPress Admin", "Google Analytics", "cPanel" */
  label: string;
  url: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  created_at: number;
}

export interface Note {
  id: number;
  client_id: number;
  body: string;
  created_at: number;
}

export interface Task {
  id: number;
  client_id: number | null;
  client_name?: string | null;
  client_color?: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: number | null;
  recurring: 'none' | 'weekly' | 'monthly';
  created_at: number;
  completed_at: number | null;
}

export type ContentPlatform = 'facebook' | 'instagram' | 'youtube' | 'linkedin' | null;
export type ContentStatus = 'draft' | 'scheduled' | 'published';

export interface ContentItem {
  id: number;
  client_id: number | null;
  client_name?: string | null;
  platform: string | null;
  type: string;
  content: string;
  scheduled_date: string; // YYYY-MM-DD
  status: ContentStatus;
  created_at: number;
}

export type TrackerStatus = 'running' | 'paused' | 'done';

export interface TimeEntry {
  id: number;
  client_id: number | null;
  task_id: number | null;
  client_name?: string | null;
  task_title?: string | null;
  description: string | null;
  /** YYYY-MM-DD local date this session belongs to */
  date: string;
  /** Current session state */
  status: TrackerStatus;
  /** Timestamp when the current running segment started (null when paused/done) */
  segment_started_at: number | null;
  /** Total ms accumulated from all completed (paused) segments */
  accumulated_ms: number;
  /** Original creation time (first Start of day) */
  started_at: number;
  /** When the session was fully finalized (status=done) */
  ended_at: number | null;
  /** Final total duration set when status=done */
  duration_ms: number | null;
}

export interface Screenshot {
  id: number;
  time_entry_id: number;
  file_path: string;
  taken_at: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface Invoice {
  id: number;
  client_id: number | null;
  client_name?: string | null;
  client_company?: string | null;
  number: string;
  issue_date: number;
  due_date: number | null;
  status: InvoiceStatus;
  notes: string | null;
  items: InvoiceItem[];
  tax_rate: number;
  discount: number;
  total?: number;
  created_at: number;
  paid_at: number | null;
}

export interface AgencyInfo {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  currency: string;
  logo_data_url: string;
  primary_color: string;
  invoice_footer: string;
  invoice_prefix: string;
}

export interface SeoStatus {
  installed: boolean;
  running: boolean;
  url: string;
  path: string;
}

declare global {
  interface Window {
    api: {
      clients: {
        list: () => Promise<Client[]>;
        get: (id: number) => Promise<Client | null>;
        create: (data: Partial<Client>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<Client>) => Promise<{ ok: true }>;
        setStage: (id: number, stage: PipelineStage) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
      };
      social: {
        listForClient: (clientId: number) => Promise<SocialAccount[]>;
        create: (data: Partial<SocialAccount>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<SocialAccount>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        open: (url: string) => Promise<void>;
      };
      notes: {
        listForClient: (clientId: number) => Promise<Note[]>;
        create: (data: { client_id: number; body: string }) => Promise<{ id: number }>;
        update: (id: number, body: string) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
      };
      websiteLogins: {
        listForClient: (clientId: number) => Promise<WebsiteLogin[]>;
        create: (data: Partial<WebsiteLogin>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<WebsiteLogin>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        open: (url: string) => Promise<void>;
      };
      tasks: {
        list: (filter?: { clientId?: number | null; status?: string }) => Promise<Task[]>;
        create: (data: Partial<Task>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<Task>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        dueAlerts: () => Promise<(Task & { isOverdue: boolean; isDueToday: boolean })[]>;
      };
      tracker: {
        start: (opts: { clientId?: number | null; taskId?: number | null; description?: string }) => Promise<{ ok: boolean; error?: string; entryId?: number }>;
        pause: () => Promise<{ ok: boolean; error?: string }>;
        resume: () => Promise<{ ok: boolean; error?: string }>;
        stop: () => Promise<{ ok: boolean; error?: string; durationMs?: number }>;
        status: () => Promise<{ status: 'running' | 'paused' | 'idle'; entry?: TimeEntry }>;
        todaySession: (clientId: number) => Promise<TimeEntry | null>;
        entries: (filter?: { clientId?: number | null; date?: string }) => Promise<TimeEntry[]>;
        screenshots: (entryId: number) => Promise<Screenshot[]>;
        readScreenshot: (filePath: string) => Promise<string | null>;
        openScreenshotsDir: () => Promise<void>;
        onScreenshot: (cb: (payload: any) => void) => () => void;
        onStatusChange: (cb: (payload: { status: 'running' | 'paused' | 'idle'; entry?: TimeEntry }) => void) => () => void;
      };
      invoices: {
        list: (filter?: { clientId?: number | null }) => Promise<Invoice[]>;
        get: (id: number) => Promise<(Invoice & { client?: Client | null }) | null>;
        nextNumber: () => Promise<string>;
        create: (data: Partial<Invoice>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<Invoice>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        renderHtml: (id: number | null, sample?: boolean) => Promise<string>;
        exportPdf: (id: number) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
        exportSamplePdf: () => Promise<{ ok: boolean; filePath?: string }>;
        fromTimeEntries: (opts: { clientId: number; entryIds: number[]; hourlyRate: number }) => Promise<{ ok: boolean; invoiceId?: number; number?: string; error?: string }>;
      };
      reports: {
        clientHtml: (clientId: number) => Promise<string>;
        clientPdf: (clientId: number) => Promise<{ ok: boolean; filePath?: string }>;
        weeklyPdf: (opts: { clientId?: number | null; weekStart: string }) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      };
      content: {
        list: (filter?: { clientId?: number | null; month?: string }) => Promise<ContentItem[]>;
        create: (data: Partial<ContentItem>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<ContentItem>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
      };
      agency: {
        get: () => Promise<AgencyInfo>;
        set: (payload: Partial<Record<string, string>>) => Promise<{ ok: true }>;
        uploadLogo: () => Promise<{ ok: boolean; path?: string }>;
        clearLogo: () => Promise<{ ok: true }>;
      };
      settings: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<{ ok: true }>;
      };
      stats: {
        dashboard: (clientId?: number | null) => Promise<{
          totalClients: number;
          openTasks: number;
          doneTasks: number;
          trackedMs: number;
        }>;
        revenueByMonth: () => Promise<{ month: string; paid: number; outstanding: number }[]>;
        timeByClient: () => Promise<{ client_id: number; name: string; color: string; ms: number }[]>;
        pipelineValue: () => Promise<Record<string, { count: number; value: number }>>;
      };
      backup: {
        export: () => Promise<{ ok: boolean; filePath?: string }>;
        import: () => Promise<{ ok: boolean; error?: string }>;
        openDataFolder: () => Promise<void>;
      };
      ai: {
        status: () => Promise<{
          configured: boolean; model: string; provider: string;
          anthropicConfigured: boolean; anthropicModel: string;
          openaiConfigured: boolean; openaiModel: string;
          ollamaConfigured: boolean; ollamaModel: string; ollamaUrl: string;
        }>;
        setProvider: (provider: string) => Promise<{ ok: true }>;
        setKey: (provider: string, key: string) => Promise<{ ok: true }>;
        clearKey: (provider: string) => Promise<{ ok: true }>;
        setModel: (provider: string, model: string) => Promise<{ ok: true }>;
        testKey: (provider: string, key: string) => Promise<{ ok: boolean; response?: string; error?: string }>;
        listOllamaModels: (url?: string) => Promise<{ ok: boolean; models: string[]; error?: string }>;
        generatePlan: (opts: {
          clientName?: string | null; clientCompany?: string | null; clientNotes?: string | null;
          brandAbout?: string | null; targetAudience?: string | null; services?: string | null;
          brandVoice?: string | null; socialGoals?: string | null; keywords?: string | null; website?: string | null;
          platforms: string[]; postsPerWeek: number; startDate: string; weeks: number;
          themes?: string; tone?: string;
        }) => Promise<{ ok: boolean; posts?: { date: string; platform: string; topic: string; content: string }[]; error?: string }>;
        onPlanProgress: (cb: (p: { batch: number; total: number; label: string; collected: number }) => void) => () => void;
        onPlanChunk: (cb: (p: { text: string }) => void) => () => void;
        generate: (
          opts: {
            type: 'social_post' | 'email' | 'caption' | 'headline' | 'custom';
            platform?: 'facebook' | 'instagram' | 'youtube' | 'linkedin' | null;
            topic: string;
            tone?: string;
            length?: 'short' | 'medium' | 'long';
            variants?: number;
            client_context?: { name?: string; company?: string; notes?: string } | null;
            custom_instructions?: string;
          },
          requestId: string
        ) => Promise<{ ok: boolean; text?: string; error?: string; usage?: any }>;
        onChunk: (cb: (p: { requestId: string; text: string }) => void) => () => void;
        onDone: (cb: (p: { requestId: string; text: string; usage?: any }) => void) => () => void;
        onError: (cb: (p: { requestId: string; error: string }) => void) => () => void;
      };
      seo: {
        status: (p?: string) => Promise<SeoStatus>;
        launch: (p?: string) => Promise<{ ok: boolean; error?: string; url: string }>;
        openInBrowser: () => Promise<void>;
        setPath: () => Promise<{ ok: boolean; path?: string }>;
      };
      app: {
        onNotify: (cb: (payload: { type: string; title: string; description?: string }) => void) => () => void;
        getRunInBackground: () => Promise<boolean>;
        setRunInBackground: (v: boolean) => Promise<{ ok: true }>;
        refreshTray: () => Promise<void>;
        getVersion: () => Promise<string>;
      };
      expenses: {
        list: (filter?: { clientId?: number | null; month?: string }) => Promise<Expense[]>;
        create: (data: Partial<Expense>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<Expense>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        exportCsv: (filter?: { clientId?: number | null }) => Promise<{ ok: boolean; filePath?: string }>;
      };
      proposals: {
        list: (filter?: { clientId?: number | null }) => Promise<Proposal[]>;
        get: (id: number) => Promise<(Proposal & { client?: Client | null }) | null>;
        nextNumber: () => Promise<string>;
        create: (data: Partial<Proposal>) => Promise<{ id: number }>;
        update: (id: number, data: Partial<Proposal>) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
        exportPdf: (id: number) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
        convertToInvoice: (id: number) => Promise<{ ok: boolean; invoiceId?: number; error?: string }>;
      };
      checklists: {
        listForClient: (clientId: number) => Promise<ChecklistItem[]>;
        create: (data: { client_id: number; title: string }) => Promise<{ id: number }>;
        toggle: (id: number) => Promise<{ ok: true }>;
        delete: (id: number) => Promise<{ ok: true }>;
      };
      exports: {
        invoicesCsv: (filter?: { clientId?: number | null }) => Promise<{ ok: boolean; filePath?: string }>;
        timeEntriesCsv: (filter?: { clientId?: number | null }) => Promise<{ ok: boolean; filePath?: string }>;
        clientsCsv: () => Promise<{ ok: boolean; filePath?: string }>;
      };
    };
  }
}
