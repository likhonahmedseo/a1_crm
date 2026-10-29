from __future__ import annotations

import logging
import os
import re
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from typing import Any, Callable

from app.services.ai import classify_reply, generate_auto_reply

logger = logging.getLogger(__name__)

# Safety limits
MAX_AUTO_REPLIES = 3

# If any of these appear in a reply body, close the thread permanently
STOP_PHRASES = frozenset({
    "unsubscribe",
    "remove me",
    "remove from",
    "stop emailing",
    "stop contacting",
    "not interested",
    "no thank you",
    "no thanks",
    "please don't",
    "do not contact",
    "don't contact",
    "opt out",
})


class ConversationManager:
    """
    Manages per-contact conversation threads.
    - Receives reply dicts from InboxMonitor
    - Classifies reply intent via AI
    - Generates auto-replies via AI
    - Sends replies via SMTP
    - Persists all threads in state storage
    """

    def __init__(
        self,
        load_state_fn: Callable[[], dict[str, Any]],
        save_state_fn: Callable[..., None],
        get_config_fn: Callable[[], dict[str, Any]],
    ) -> None:
        self._load_state = load_state_fn
        self._save_state = save_state_fn
        self._get_config = get_config_fn

    # ── Public getters ────────────────────────────────────────────────────────

    def get_all(self) -> list[dict[str, Any]]:
        return self._load_state().get("conversations", [])

    def get_by_email(self, addr: str) -> dict[str, Any] | None:
        return next(
            (c for c in self.get_all() if c["email"].lower() == addr.lower()),
            None,
        )

    # ── Bootstrap from sent drafts ────────────────────────────────────────────

    def init_from_drafts(self, drafts: list[dict[str, Any]]) -> None:
        """
        Create a fresh conversation thread for every draft that was just sent.
        Called by the /api/generate and /api/send-gmail endpoints after sending.
        """
        convs = self.get_all()
        existing = {c["email"].lower() for c in convs}

        for draft in drafts:
            if draft.get("status") != "sent":
                continue
            addr = draft["email"].lower()
            if addr in existing:
                continue

            convs.append(_new_thread(
                email=draft["email"],
                initial_body=draft.get("body", ""),
                initial_subject=draft.get("subject", ""),
            ))
            existing.add(addr)

        self._save_state(conversations=convs)

    # ── Reply processing pipeline ─────────────────────────────────────────────

    def process_reply(self, reply_info: dict[str, Any]) -> None:
        """
        Main entry point called by InboxMonitor for each new reply.
        Runs the full classify → generate → send pipeline.
        """
        sender = _extract_email(reply_info.get("from", ""))
        body   = reply_info.get("body", "").strip()

        if not sender or not body:
            return

        convs = self.get_all()
        conv  = next((c for c in convs if c["email"].lower() == sender.lower()), None)

        if conv is None:
            # Unsolicited reply — create a thread so we can track it
            conv = _new_thread(email=sender)
            convs.append(conv)

        # --- Guard rails ---
        if conv["status"] in ("not_interested", "closed"):
            logger.info(f"Thread with {sender} is closed — skipping.")
            return

        if conv["auto_reply_count"] >= MAX_AUTO_REPLIES:
            conv["status"] = "limit_reached"
            self._save_state(conversations=convs)
            logger.info(f"Max auto-replies reached for {sender}.")
            return

        # --- Log their inbound message ---
        inbound: dict[str, Any] = {
            "direction": "received",
            "body": body,
            "timestamp": datetime.utcnow().isoformat(),
            "classification": None,
        }
        conv["messages"].append(inbound)

        # --- Check for explicit opt-out ---
        body_lower = body.lower()
        if any(phrase in body_lower for phrase in STOP_PHRASES):
            inbound["classification"] = "not_interested"
            conv["status"] = "not_interested"
            self._save_state(conversations=convs)
            logger.info(f"Stop phrase detected from {sender}. Closing thread.")
            return

        # --- Classify reply ---
        config = self._get_config()
        try:
            classification = classify_reply(body)
        except Exception as exc:
            logger.error(f"Classification failed for {sender}: {exc}")
            classification = "other"

        inbound["classification"] = classification

        if classification == "not_interested":
            conv["status"] = "not_interested"
            self._save_state(conversations=convs)
            return

        if classification == "out_of_office":
            # Don't reply, just track it
            conv["last_activity"] = datetime.utcnow().isoformat()
            self._save_state(conversations=convs)
            return

        # --- Generate auto-reply ---
        try:
            reply_body = generate_auto_reply(
                thread_messages=conv["messages"],
                latest_reply=body,
                classification=classification,
                config_dict=config,
            )
        except Exception as exc:
            logger.error(f"Auto-reply generation failed for {sender}: {exc}")
            inbound["error"] = f"AI generation failed: {exc}"
            self._save_state(conversations=convs)
            return

        if reply_body == "SKIP":
            self._save_state(conversations=convs)
            return

        # --- Queue auto-reply as pending ---
        original_subject = reply_info.get("subject", "")
        reply_subject = (
            original_subject if original_subject.lower().startswith("re:")
            else f"Re: {original_subject}"
        )

        conv["pending_auto_reply"] = {
            "subject": reply_subject,
            "body": reply_body,
            "classification": classification,
            "generated_at": datetime.utcnow().isoformat(),
        }

        self._save_state(conversations=convs)
        logger.info(f"Auto-reply generated and pending approval for {sender}")

    def check_pending_replies(self) -> None:
        """Called periodically to auto-send pending replies older than 5 mins."""
        convs = self.get_all()
        changed = False
        now = datetime.utcnow()

        for conv in convs:
            pending = conv.get("pending_auto_reply")
            if pending:
                gen_at_str = pending.get("generated_at")
                if gen_at_str:
                    try:
                        gen_at = datetime.fromisoformat(gen_at_str)
                    except ValueError:
                        continue
                    
                    if (now - gen_at).total_seconds() >= 300:  # 5 minutes
                        self._send_and_clear_pending(conv, pending)
                        changed = True

        if changed:
            self._save_state(conversations=convs)

    def approve_pending_reply(self, addr: str, edited_body: str | None = None) -> None:
        convs = self.get_all()
        conv = next((c for c in convs if c["email"].lower() == addr.lower()), None)
        if not conv or "pending_auto_reply" not in conv:
            raise ValueError(f"No pending reply found for {addr}")
        
        pending = conv["pending_auto_reply"]
        if edited_body is not None:
            pending["body"] = edited_body
        
        self._send_and_clear_pending(conv, pending)
        self._save_state(conversations=convs)

    def cancel_pending_reply(self, addr: str) -> None:
        convs = self.get_all()
        conv = next((c for c in convs if c["email"].lower() == addr.lower()), None)
        if not conv or "pending_auto_reply" not in conv:
            raise ValueError(f"No pending reply found for {addr}")
        
        del conv["pending_auto_reply"]
        self._save_state(conversations=convs)

    def _send_and_clear_pending(self, conv: dict[str, Any], pending: dict[str, Any]) -> None:
        sender = conv["email"]
        reply_subject = pending["subject"]
        reply_body = pending["body"]
        classification = pending.get("classification", "auto_reply")

        outbound: dict[str, Any] = {
            "direction": "sent",
            "body": reply_body,
            "timestamp": datetime.utcnow().isoformat(),
            "classification": classification,
        }

        try:
            _smtp_send(
                to_email=sender,
                subject=reply_subject,
                body=reply_body,
            )
            conv["auto_reply_count"] += 1
            conv["last_activity"] = datetime.utcnow().isoformat()

            if classification == "interested":
                conv["status"] = "progressing"

            conv["messages"].append(outbound)
            logger.info(
                f"Auto-reply sent to {sender} "
                f"(classification={classification}, reply #{conv['auto_reply_count']})"
            )

        except Exception as exc:
            outbound["error"] = str(exc)
            outbound["classification"] = "auto_reply_failed"
            conv["messages"].append(outbound)
            logger.error(f"Failed to send auto-reply to {sender}: {exc}")

        del conv["pending_auto_reply"]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _new_thread(
    email: str,
    initial_body: str = "",
    initial_subject: str = "",
) -> dict[str, Any]:
    thread: dict[str, Any] = {
        "email":             email,
        "status":            "active",
        "auto_reply_count":  0,
        "created_at":        datetime.utcnow().isoformat(),
        "last_activity":     datetime.utcnow().isoformat(),
        "messages":          [],
    }
    if initial_body:
        thread["messages"].append({
            "direction":      "sent",
            "body":           initial_body,
            "subject":        initial_subject,
            "timestamp":      datetime.utcnow().isoformat(),
            "classification": "initial_outreach",
        })
    return thread


def _extract_email(from_field: str) -> str:
    """Extract bare email address from a 'Name <email>' header value."""
    m = re.search(r"<([^>]+)>", from_field)
    return m.group(1).strip() if m else from_field.strip()


def _smtp_send(to_email: str, subject: str, body: str) -> None:
    host     = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port     = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls  = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    if not username or not password:
        raise ValueError(
            "SMTP credentials are not configured. "
            "Add SMTP_USERNAME and SMTP_PASSWORD to your .env file."
        )

    msg = EmailMessage()
    msg["From"]    = username
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    ctx = ssl.create_default_context()
    with smtplib.SMTP(host, port) as server:
        if use_tls:
            server.starttls(context=ctx)
        server.login(username, password)
        server.send_message(msg)
