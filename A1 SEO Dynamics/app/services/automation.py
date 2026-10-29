from __future__ import annotations

import json
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Generator
from urllib.parse import quote, urlencode

from dotenv import load_dotenv

from app.models import DraftEmail


load_dotenv(override=True)


# ─── Gmail URL builder (kept for reference / open-tab fallback) ───────────────

def build_gmail_compose_url(draft: DraftEmail) -> str:
    query = urlencode(
        {
            "view": "cm",
            "fs": "1",
            "tf": "1",
            "to": draft.email,
            "su": draft.subject,
            "body": draft.body,
        }
    )
    return f"https://mail.google.com/mail/?{query}"


# ─── Chrome path helpers ──────────────────────────────────────────────────────

def _chrome_user_data_dir() -> str:
    """Return the default Chrome user-data directory on Windows."""
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    return os.path.join(local_app_data, "Google", "Chrome", "User Data")


# ─── Gmail browser automation ─────────────────────────────────────────────────

def send_via_gmail_browser(
    drafts: list[DraftEmail],
    limit: int | None = None,
) -> Generator[dict, None, None]:
    """
    Controls the user's Chrome browser (using their existing login session)
    to compose and send each draft directly through Gmail.

    Yields progress dicts consumed by the Flask SSE endpoint:
      sending  → {index, email, status:"sending", total}
      sent     → {index, email, status:"sent",    total}
      failed   → {index, email, status:"failed",  error, total}
      done     → {done:True, sent:N, failed:N}
      fatal    → {fatal:True, error:"..."}
    """
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    to_send = drafts[:limit] if limit else drafts
    total = len(to_send)
    sent_count = 0
    failed_count = 0

    user_data_dir = _chrome_user_data_dir()

    try:
        with sync_playwright() as p:
            # Launch Chrome reusing the user's existing profile (already logged in)
            try:
                context = p.chromium.launch_persistent_context(
                    user_data_dir=user_data_dir,
                    channel="chrome",          # use the installed Chrome, not Chromium
                    headless=False,            # visible so user can see it working
                    args=[
                        "--profile-directory=Default",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-infobars",
                    ],
                    slow_mo=80,
                )
            except Exception as exc:
                msg = str(exc).lower()
                if "running" in msg or "lock" in msg or "already" in msg or "exit" in msg:
                    yield {
                        "fatal": True,
                        "error": (
                            "Chrome is currently open. "
                            "Please close ALL Chrome windows and try again."
                        ),
                    }
                else:
                    yield {"fatal": True, "error": f"Could not launch Chrome: {exc}"}
                return

            page = context.new_page()

            # Verify Gmail is accessible (user is logged in)
            page.goto("https://mail.google.com/mail/u/0/", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000)

            if "accounts.google.com" in page.url:
                yield {
                    "fatal": True,
                    "error": (
                        "You are not logged into Gmail in Chrome. "
                        "Please open Chrome, log into Gmail, then try again."
                    ),
                }
                context.close()
                return

            # Send each draft
            for i, draft in enumerate(to_send):
                yield {"index": i, "email": draft.email, "status": "sending", "total": total}

                try:
                    _compose_and_send(page, draft)
                    draft.status = "sent"
                    draft.error = None
                    sent_count += 1
                    yield {"index": i, "email": draft.email, "status": "sent", "total": total}

                except PWTimeout as exc:
                    draft.status = "failed"
                    draft.error = f"Timed out waiting for Gmail: {exc}"
                    failed_count += 1
                    yield {
                        "index": i,
                        "email": draft.email,
                        "status": "failed",
                        "error": draft.error,
                        "total": total,
                    }

                except Exception as exc:
                    draft.status = "failed"
                    draft.error = str(exc)
                    failed_count += 1
                    yield {
                        "index": i,
                        "email": draft.email,
                        "status": "failed",
                        "error": draft.error,
                        "total": total,
                    }

                # Pause between sends to avoid triggering spam filters
                time.sleep(1.5)

            context.close()

    except Exception as exc:
        yield {"fatal": True, "error": str(exc)}
        return

    yield {"done": True, "sent": sent_count, "failed": failed_count, "total": total}


def _compose_and_send(page, draft: DraftEmail) -> None:
    """
    Opens Gmail compose using the URL approach (pre-fills To + Subject),
    types the body, then sends with Ctrl+Enter.
    Raises on any playwright timeout or error.
    """
    from playwright.sync_api import TimeoutError as PWTimeout

    # Navigate to Gmail compose with To and Subject pre-filled via URL params.
    # Body is too long / binary-unsafe for URL; we fill it via JS.
    compose_url = (
        "https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1"
        f"&to={quote(draft.email)}"
        f"&su={quote(draft.subject)}"
    )
    page.goto(compose_url, wait_until="domcontentloaded", timeout=20000)

    # Wait for the compose message body to appear
    body_sel = 'div[aria-label="Message Body"]'
    body_el = page.wait_for_selector(body_sel, timeout=15000)

    # Click the body area to focus it
    body_el.click()

    # Use execCommand (works reliably in contenteditable Gmail body)
    page.evaluate(
        """(text) => {
            const el = document.querySelector('div[aria-label="Message Body"]');
            if (!el) throw new Error('Body element not found');
            el.focus();
            // Clear any existing content first
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, text);
        }""",
        draft.body,
    )

    # Small pause so Gmail registers the content
    page.wait_for_timeout(500)

    # Send: Ctrl+Enter is the universal Gmail keyboard shortcut for Send
    page.keyboard.press("Control+Enter")

    # Wait for the compose window to close (body element disappears = message sent)
    try:
        page.wait_for_selector(body_sel, state="detached", timeout=10000)
    except PWTimeout:
        # In some Gmail configs the compose stays open after send.
        # Try clicking the Send button as a fallback.
        try:
            send_btn = page.locator('[data-tooltip*="Send"], [aria-label*="Send"]').first
            send_btn.click(timeout=3000)
            page.wait_for_selector(body_sel, state="detached", timeout=8000)
        except Exception:
            # Accept it — the email was most likely sent
            pass

    # Brief pause before the next email
    page.wait_for_timeout(1000)


# ─── SMTP sender (unchanged) ──────────────────────────────────────────────────

def send_via_smtp(drafts: list[DraftEmail], sender_email: str) -> list[DraftEmail]:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not host or not username or not password:
        raise ValueError("SMTP settings are incomplete. Add them to your .env file.")

    updated: list[DraftEmail] = []

    if use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port) as server:
            server.starttls(context=context)
            server.login(username, password)
            for draft in drafts:
                updated.append(_send_message(server, draft, sender_email))
    else:
        with smtplib.SMTP_SSL(host, port) as server:
            server.login(username, password)
            for draft in drafts:
                updated.append(_send_message(server, draft, sender_email))

    return updated


def _send_message(server: smtplib.SMTP, draft: DraftEmail, sender_email: str) -> DraftEmail:
    message = EmailMessage()
    message["From"] = sender_email
    message["To"] = draft.email
    message["Subject"] = draft.subject
    message.set_content(draft.body)

    try:
        server.send_message(message)
        draft.status = "sent"
        draft.error = None
    except Exception as exc:
        draft.status = "failed"
        draft.error = str(exc)

    return draft
