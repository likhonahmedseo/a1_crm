# A1 CRM

By **A1 Technovation** — offline-first agency CRM for managing clients, social media, tasks, time, sales pipeline, and invoicing.

## Modules

1. **Centralized Clients** — profiles, social accounts (FB / IG / YouTube / LinkedIn), workspace switcher.
2. **Activity Log** — daily work notes & timeline per client.
3. **Tasks** — to-do list with priority, due dates, status, per-client filtering.
4. **Time Tracker** — live timer + automatic random screenshots every 5–10 minutes.
5. **Sales Pipeline** — drag-and-drop Kanban (Lead → Contacted → Proposal → Won/Lost) with deal value.
6. **Invoicing** — full editor, sample/demo preview, PDF export. No payment gateway — invoice copies only.
7. **Reports & Analytics** — revenue by month, time by client, pipeline value breakdown.
8. **Client Report** — exportable PDF combining tasks, activity, time, invoices for a client.
9. **White-label** — agency logo, address, currency, brand color, invoice footer/prefix.
10. **Marketing — A1 SEO Dynamics** — launches your existing email-marketing Flask app and embeds it.
11. **AI Content Writer** — generates social posts, captions, headlines, and marketing emails using Claude (Anthropic). Per-client brand context, tone/length controls, multiple variants, streaming output, save-as-note.
12. **Backup & Restore** — JSON export/import. Local data folder shortcut.

## AI setup

1. Get a key at https://console.anthropic.com/settings/keys
2. Settings → AI Content Writer → paste key → Save → Test
3. The key is stored in `%APPDATA%\A1 CRM\a1crm.json` and is sent only to `api.anthropic.com`. Never committed to source. Use **Remove saved key** to wipe.

Default model is **Claude Haiku 4.5** (fast & cheap). Switch to Sonnet 4.6 for better copy on important campaigns.

## Notes on offline mode

- **Facebook integration** (PRD #5): kept as URL/credential records with one-click "open in browser." True API page-management requires internet + Meta app review and isn't possible offline.
- **Client portal** (PRD #7): replaced by **PDF Client Reports** that you email/share with clients. A real portal needs a hosted backend.

## Stack

- Electron + React 18 + TypeScript + Vite + Tailwind
- Local JSON store (atomic writes, debounced persistence) — no native deps
- Electron `desktopCapturer` for screenshots, `printToPDF` for invoices

## Development

```bash
npm install
npm run dev       # Electron + Vite dev server
```

Or just double-click **`Start A1 CRM.bat`**.

## Production build

```bash
npm run build
```

Or double-click **`Build Installer.bat`** (will request admin to satisfy electron-builder's symlink extraction). Output: `release/A1 CRM Setup x.y.z.exe`.

## A1 SEO Dynamics integration

The CRM expects A1 SEO Dynamics at `D:\A1 Technovation\A1 SEO Dynamics`. If it's elsewhere, click **Marketing → Locate** to point it. Pressing **Launch** runs `start_app.bat` (Flask on :5000) and embeds it.

## Storage

- Database: `%APPDATA%\A1 CRM\a1crm.json`
- Screenshots: `%APPDATA%\A1 CRM\screenshots\`
- Logo: `%APPDATA%\A1 CRM\branding\`

Open the data folder from **Settings → Backup & data**.
# a1_crm
