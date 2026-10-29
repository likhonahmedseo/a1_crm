import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

interface Schema {
  clients: any[];
  social_accounts: any[];
  website_logins: any[];
  tasks: any[];
  time_entries: any[];
  screenshots: any[];
  notes: any[];
  deals: any[];
  invoices: any[];
  proposals: any[];
  expenses: any[];
  checklists: any[];
  content_items: any[];
  settings: Record<string, string>;
  _seq: Record<string, number>;
}

const empty = (): Schema => ({
  clients: [],
  social_accounts: [],
  website_logins: [],
  tasks: [],
  time_entries: [],
  screenshots: [],
  notes: [],
  deals: [],
  invoices: [],
  proposals: [],
  expenses: [],
  checklists: [],
  content_items: [],
  settings: {},
  _seq: {
    clients: 0,
    social_accounts: 0,
    website_logins: 0,
    tasks: 0,
    time_entries: 0,
    screenshots: 0,
    notes: 0,
    deals: 0,
    invoices: 0,
    proposals: 0,
    expenses: 0,
    checklists: 0,
    content_items: 0,
  },
});

let data: Schema;
let dbPath = '';
let writeTimer: NodeJS.Timeout | null = null;

function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      const tmp = dbPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, dbPath);
    } catch (e) {
      console.error('DB persist error', e);
    }
    writeTimer = null;
  }, 50);
}

export function flushDb() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  try {
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, dbPath);
  } catch (e) {
    console.error('DB flush error', e);
  }
}

export function initDb() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, 'a1crm.json');

  if (fs.existsSync(dbPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      const e = empty();
      data = { ...e, ...parsed, _seq: { ...e._seq, ...(parsed._seq || {}) } };
      for (const k of Object.keys(e) as (keyof Schema)[]) {
        if ((data as any)[k] === undefined) (data as any)[k] = (e as any)[k];
      }
    } catch {
      data = empty();
    }
  } else {
    data = empty();
    persist();
  }
  return data;
}

export function getDb() {
  if (!data) throw new Error('DB not initialized');
  return data;
}

export function nextId(table: keyof Schema['_seq']) {
  data._seq[table] = (data._seq[table] || 0) + 1;
  return data._seq[table];
}

export function save() { persist(); }
export function getDbPath() { return dbPath; }

export function replaceDb(payload: any) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup payload');
  const e = empty();
  data = { ...e, ...payload, _seq: { ...e._seq, ...(payload._seq || {}) } };
  flushDb();
}
