# Marketing Automation App

This is a local Python web app for:

- importing contact lists
- generating marketing email drafts from a mission brief
- exporting draft-ready campaigns
- triggering controlled local automation for browser-based drafting or SMTP sending

## What this app does

You provide:

- a CSV email list
- a campaign mission/task
- optional sender name, company, offer, CTA, and tone

The app will:

- normalize your contacts
- create personalized subject lines and email bodies
- show a preview before anything is sent
- export drafts to CSV/JSON
- optionally automate browser drafting for Gmail
- optionally send email through SMTP if you configure credentials

## Important safety note

This app runs on your local computer, but it does **not** give silent unrestricted control over your machine. Instead, it exposes specific automation actions that you can trigger from the UI or scripts:

- generate drafts
- open Gmail draft tabs in your browser
- send messages through SMTP

That is the safest practical version of "local computer access" for this workflow.

## Project structure

```text
app/
  main.py
  web.py
  models.py
  static/
  templates/
  services/
    automation.py
    contacts.py
    drafts.py
    storage.py
data/
  runtime/
requirements.txt
```

## CSV format

Recommended columns:

```csv
email,first_name,last_name,company,role,website,notes
jane@example.com,Jane,Doe,Acme,Marketing Lead,https://acme.com,Interested in lead gen
```

Only the `email` column is required.

## Quick start

1. Create a virtual environment
2. Install requirements
3. Run the app

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app/main.py
```

Then open `http://127.0.0.1:5000` in your browser.

## SMTP setup

Create a `.env` file if you want direct sending:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=you@example.com
SMTP_PASSWORD=app-password-here
SMTP_USE_TLS=true
```

## Web UI features

- campaign builder form
- contacts table
- draft preview panel
- Gmail compose tab launcher
- CSV/JSON export
- SMTP sending
- local disk-backed campaign state

## Browser automation

The app can open Gmail compose drafts in your browser using prefilled recipient, subject, and body fields.

If you want stronger browser automation later, we can extend this with Playwright to:

- log into approved tools
- click UI elements
- read inbox pages you open
- process replies with approval checkpoints

## Next good upgrades

- OpenAI or local LLM integration for smarter draft writing
- reply classification for incoming leads
- lead stage tracking
- scheduled campaigns
- inbox triage dashboard
- CRM sync
