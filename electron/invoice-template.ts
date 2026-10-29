interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceData {
  number: string;
  issue_date: number;
  due_date: number | null;
  status: string;
  notes: string | null;
  items: InvoiceItem[];
  tax_rate: number; // percentage
  discount: number; // amount
  client?: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
}

interface AgencyInfo {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  currency: string;
  logo_data_url?: string;
  primary_color: string;
  invoice_footer: string;
}

function escapeHtml(s: string | null | undefined) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(ms: number | null) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function renderInvoiceHtml(invoice: InvoiceData, agency: AgencyInfo): string {
  const subtotal = invoice.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmt = (subtotal - invoice.discount) * (invoice.tax_rate / 100);
  const total = subtotal - invoice.discount + taxAmt;
  const currency = agency.currency || 'USD';
  const color = agency.primary_color || '#3b6ef5';

  const rows = invoice.items
    .map((it) => {
      const line = it.quantity * it.unit_price;
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.description)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${it.quantity}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtMoney(it.unit_price, currency)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtMoney(line, currency)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Invoice ${escapeHtml(invoice.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 13px; }
  .header { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid ${color}; }
  .agency-name { font-size: 22px; font-weight: 700; color: ${color}; margin: 0; }
  .agency-meta { color: #64748b; font-size: 11px; line-height: 1.6; margin-top: 6px; }
  .logo { max-height: 56px; max-width: 200px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 28px; margin: 0; letter-spacing: 2px; color: #0f172a; }
  .invoice-meta { font-size: 11px; color: #64748b; margin-top: 8px; line-height: 1.7; }
  .billto { margin-bottom: 24px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
  .client-name { font-weight: 600; font-size: 14px; }
  .client-meta { color: #475569; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: ${color}; color: white; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th.right { text-align: right; }
  .totals { margin-top: 16px; margin-left: auto; width: 320px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .totals .total { font-size: 16px; font-weight: 700; color: ${color}; padding-top: 10px; border-top: 2px solid ${color}; border-bottom: none; }
  .notes { margin-top: 32px; padding: 14px 16px; background: #f8fafc; border-left: 3px solid ${color}; border-radius: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #94a3b8; font-size: 10px; }
  .status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-paid { background: #dcfce7; color: #166534; }
  .status-sent { background: #dbeafe; color: #1e40af; }
  .status-draft { background: #f1f5f9; color: #475569; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${agency.logo_data_url ? `<img src="${agency.logo_data_url}" class="logo" />` : `<h2 class="agency-name">${escapeHtml(agency.name)}</h2>`}
      ${agency.logo_data_url ? `<h2 class="agency-name" style="margin-top:8px;">${escapeHtml(agency.name)}</h2>` : ''}
      <div class="agency-meta">
        ${escapeHtml(agency.address).replace(/\n/g, '<br/>')}<br/>
        ${escapeHtml(agency.email)} ${agency.phone ? `· ${escapeHtml(agency.phone)}` : ''}
        ${agency.website ? `<br/>${escapeHtml(agency.website)}` : ''}
      </div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-meta">
        <strong>#${escapeHtml(invoice.number)}</strong><br/>
        Issued: ${fmtDate(invoice.issue_date)}<br/>
        Due: ${fmtDate(invoice.due_date)}<br/>
        <span class="status-pill status-${invoice.status}">${escapeHtml(invoice.status)}</span>
      </div>
    </div>
  </div>

  <div class="billto">
    <div class="label">Bill to</div>
    <div class="client-name">${escapeHtml(invoice.client?.name || '—')}</div>
    <div class="client-meta">
      ${invoice.client?.company ? escapeHtml(invoice.client.company) + '<br/>' : ''}
      ${invoice.client?.email ? escapeHtml(invoice.client.email) + ' ' : ''}
      ${invoice.client?.phone ? '· ' + escapeHtml(invoice.client.phone) : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right" style="width:80px;">Qty</th>
        <th class="right" style="width:120px;">Unit Price</th>
        <th class="right" style="width:140px;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmtMoney(subtotal, currency)}</span></div>
    ${invoice.discount ? `<div class="row"><span>Discount</span><span>− ${fmtMoney(invoice.discount, currency)}</span></div>` : ''}
    ${invoice.tax_rate ? `<div class="row"><span>Tax (${invoice.tax_rate}%)</span><span>${fmtMoney(taxAmt, currency)}</span></div>` : ''}
    <div class="row total"><span>Total</span><span>${fmtMoney(total, currency)}</span></div>
  </div>

  ${invoice.notes ? `<div class="notes"><div class="label">Notes</div>${escapeHtml(invoice.notes).replace(/\n/g, '<br/>')}</div>` : ''}

  <div class="footer">
    ${escapeHtml(agency.invoice_footer || `Thank you for your business — ${agency.name}`)}
  </div>
</body>
</html>`;
}

export function renderClientReportHtml(opts: {
  client: any;
  tasks: any[];
  entries: any[];
  invoices: any[];
  notes: any[];
  agency: AgencyInfo;
  totalTrackedMs: number;
}): string {
  const { client, tasks, entries, invoices, notes, agency, totalTrackedMs } = opts;
  const color = agency.primary_color || '#3b6ef5';
  const currency = agency.currency || 'USD';
  const totalHrs = (totalTrackedMs / 3_600_000).toFixed(1);

  const taskRows = tasks
    .map(
      (t) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(t.title)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${t.status.replace('_', ' ')}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${fmtDate(t.due_date)}</td>
    </tr>`
    )
    .join('');

  const noteRows = notes
    .slice(0, 20)
    .map(
      (n) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;width:140px;color:#64748b;font-size:11px;">${fmtDate(n.created_at)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(n.body).replace(/\n/g, '<br/>')}</td>
    </tr>`
    )
    .join('');

  const invRows = invoices
    .map((i) => {
      const subtotal = (i.items || []).reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0);
      const total = subtotal - (i.discount || 0) + (subtotal - (i.discount || 0)) * ((i.tax_rate || 0) / 100);
      return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(i.number)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${fmtDate(i.issue_date)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${i.status}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtMoney(total, currency)}</td>
    </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>${escapeHtml(client.name)} — Client Report</title>
<style>
  body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:0;padding:32px;font-size:13px;}
  h1{color:${color};font-size:24px;margin:0 0 4px;}
  h2{color:${color};font-size:15px;margin:24px 0 8px;border-bottom:2px solid ${color};padding-bottom:4px;}
  .subtitle{color:#64748b;font-size:12px;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:${color};color:white;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
  .stats{display:flex;gap:12px;margin:16px 0;}
  .stat{flex:1;padding:12px;background:#f8fafc;border-left:3px solid ${color};border-radius:4px;}
  .stat .label{font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:.5px;}
  .stat .value{font-size:18px;font-weight:700;color:#0f172a;margin-top:2px;}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;color:#94a3b8;font-size:10px;}
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${color};padding-bottom:16px;margin-bottom:16px;">
    <div>
      <h1>${escapeHtml(client.name)}</h1>
      <div class="subtitle">${escapeHtml(client.company || '')}${client.email ? ' · ' + escapeHtml(client.email) : ''}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#64748b;">
      <strong style="color:${color};">${escapeHtml(agency.name)}</strong><br/>
      Report generated ${fmtDate(Date.now())}
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">Open tasks</div><div class="value">${tasks.filter(t=>t.status!=='done').length}</div></div>
    <div class="stat"><div class="label">Completed</div><div class="value">${tasks.filter(t=>t.status==='done').length}</div></div>
    <div class="stat"><div class="label">Hours tracked</div><div class="value">${totalHrs}h</div></div>
    <div class="stat"><div class="label">Invoices</div><div class="value">${invoices.length}</div></div>
  </div>

  <h2>Tasks</h2>
  ${tasks.length ? `<table><thead><tr><th>Title</th><th>Status</th><th>Due</th></tr></thead><tbody>${taskRows}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px;">No tasks.</p>'}

  <h2>Activity log</h2>
  ${notes.length ? `<table><tbody>${noteRows}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px;">No notes.</p>'}

  <h2>Invoices</h2>
  ${invoices.length ? `<table><thead><tr><th>Number</th><th>Issued</th><th>Status</th><th style="text-align:right;">Total</th></tr></thead><tbody>${invRows}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px;">No invoices.</p>'}

  <div class="footer">${escapeHtml(agency.name)} · ${escapeHtml(agency.email)} · Confidential</div>
</body></html>`;
}
