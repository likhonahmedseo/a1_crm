from __future__ import annotations

import csv
import io
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, request, send_file, stream_with_context

from app.models import CampaignConfig, DraftEmail
from app.services.ai import generate_email_copy
from app.services.automation import build_gmail_compose_url, send_via_gmail_browser, send_via_smtp
from app.services.contacts import load_contacts_from_csv
from app.services.conversation import ConversationManager
from app.services.drafts import generate_drafts
from app.services.inbox import InboxMonitor
from app.services.storage import load_state, reset_state, save_state

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="../client/dist", static_url_path="/")
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "local-dev-secret-key")
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
PROJECT_DIR = Path(__file__).resolve().parents[1]


# ─── Singletons ───────────────────────────────────────────────────────────────

def _current_config() -> dict[str, Any]:
    return stored_form()

conversation_manager = ConversationManager(
    load_state_fn=load_state,
    save_state_fn=save_state,
    get_config_fn=_current_config,
)

inbox_monitor = InboxMonitor(reply_callback=conversation_manager.process_reply)

def _pending_reply_loop():
    while True:
        try:
            conversation_manager.check_pending_replies()
        except Exception as exc:
            logger.error(f"Error checking pending replies: {exc}")
        time.sleep(10)

threading.Thread(target=_pending_reply_loop, daemon=True, name="PendingReplyMonitor").start()


# ─── State helpers ────────────────────────────────────────────────────────────

def get_form_defaults() -> dict[str, str]:
    return {
        "mission": "",
        "sender_name": "Likhon Ahmed",
        "sender_company": "A1 Technovation",
        "offer": "",
        "call_to_action": "would you be open to a quick 15-minute call next week",
        "tone": "professional",
        "signature": "",
        "sender_email": "",
    }


def stored_drafts() -> list[dict[str, Any]]:
    return load_state().get("drafts", [])


def stored_contacts() -> list[dict[str, Any]]:
    return load_state().get("contacts", [])


def stored_form() -> dict[str, str]:
    defaults = get_form_defaults()
    defaults.update(load_state().get("form_data", {}))
    return defaults


def build_config_from_form(form_data: dict[str, str]) -> CampaignConfig:
    return CampaignConfig(
        mission=form_data["mission"].strip(),
        sender_name=form_data["sender_name"].strip(),
        sender_company=form_data["sender_company"].strip(),
        offer=form_data["offer"].strip(),
        call_to_action=form_data["call_to_action"].strip(),
        tone=form_data["tone"].strip(),
        signature=form_data["signature"].strip(),
    )


def serialize_drafts(drafts: list[DraftEmail]) -> list[dict[str, Any]]:
    return [draft.to_dict() for draft in drafts]


def drafts_with_gmail_urls(drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for draft in drafts:
        draft_copy = dict(draft)
        draft_copy["gmail_url"] = build_gmail_compose_url(DraftEmail(**draft))
        enriched.append(draft_copy)
    return enriched


# ─── Core session endpoints ───────────────────────────────────────────────────

@app.get("/api/state")
def get_state():
    return jsonify({
        "form_data": stored_form(),
        "contacts":  stored_contacts(),
        "drafts":    drafts_with_gmail_urls(stored_drafts()),
    })


@app.get("/api/sample-csv")
def sample_csv():
    path = PROJECT_DIR / "data" / "sample_contacts.csv"
    return send_file(path, as_attachment=True, download_name="sample_contacts.csv", mimetype="text/csv")


# ─── Campaign generation (template-based) ────────────────────────────────────

@app.post("/api/generate")
def generate():
    uploaded_file = request.files.get("contacts_file")
    form_data = {
        "mission":        request.form.get("mission", ""),
        "sender_name":    request.form.get("sender_name", ""),
        "sender_company": request.form.get("sender_company", ""),
        "offer":          request.form.get("offer", ""),
        "call_to_action": request.form.get("call_to_action", ""),
        "tone":           request.form.get("tone", "professional"),
        "signature":      request.form.get("signature", ""),
        "sender_email":   request.form.get("sender_email", ""),
    }
    save_state(form_data=form_data)

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "Upload a CSV file with at least an email column."}), 400

    if not form_data["mission"].strip() or not form_data["offer"].strip() or not form_data["call_to_action"].strip():
        return jsonify({"error": "Mission, offer, and call to action are required."}), 400

    try:
        contacts = load_contacts_from_csv(uploaded_file.read())
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    if not contacts:
        return jsonify({"error": "No valid contacts found in the uploaded file."}), 400

    config = build_config_from_form(form_data)
    drafts = generate_drafts(contacts, config)

    save_state(
        contacts=[c.to_dict() for c in contacts],
        drafts=serialize_drafts(drafts),
        form_data=form_data,
    )

    return jsonify({
        "message": f"Generated {len(drafts)} draft(s) for your campaign.",
        "drafts":   drafts_with_gmail_urls(serialize_drafts(drafts)),
        "contacts": [c.to_dict() for c in contacts],
        "form_data": form_data,
    })


# ─── AI-powered generation (streams progress via SSE) ────────────────────────

@app.post("/api/generate-ai")
def generate_ai():
    """
    Like /api/generate but uses GPT-4o to write each email individually.
    Streams progress events: {index, email, status, total} or {done}.
    """
    uploaded_file = request.files.get("contacts_file")
    form_data = {
        "mission":        request.form.get("mission", ""),
        "sender_name":    request.form.get("sender_name", ""),
        "sender_company": request.form.get("sender_company", ""),
        "offer":          request.form.get("offer", ""),
        "call_to_action": request.form.get("call_to_action", ""),
        "tone":           request.form.get("tone", "professional"),
        "signature":      request.form.get("signature", ""),
        "sender_email":   request.form.get("sender_email", ""),
    }
    save_state(form_data=form_data)

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "Upload a CSV file with at least an email column."}), 400

    if not form_data["mission"].strip() or not form_data["offer"].strip():
        return jsonify({"error": "Mission and offer are required."}), 400

    try:
        contacts = load_contacts_from_csv(uploaded_file.read())
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    if not contacts:
        return jsonify({"error": "No valid contacts found."}), 400

    def stream():
        total = len(contacts)
        finished_drafts: list[DraftEmail] = []

        for i, contact in enumerate(contacts):
            yield f"data: {json.dumps({'index': i, 'email': contact.email, 'status': 'generating', 'total': total})}\n\n"
            try:
                subject, body = generate_email_copy(contact.to_dict(), form_data)
                draft = DraftEmail(
                    email=contact.email,
                    first_name=contact.first_name,
                    company=contact.company,
                    subject=subject,
                    body=body,
                )
                finished_drafts.append(draft)
                yield f"data: {json.dumps({'index': i, 'email': contact.email, 'status': 'done', 'subject': subject, 'total': total})}\n\n"
            except Exception as exc:
                logger.error(f"AI generation failed for {contact.email}: {exc}")
                # Fall back to template for this contact
                from app.services.drafts import build_draft
                from app.models import CampaignConfig
                config = build_config_from_form(form_data)
                fallback = build_draft(contact, config)
                finished_drafts.append(fallback)
                yield f"data: {json.dumps({'index': i, 'email': contact.email, 'status': 'fallback', 'error': str(exc), 'total': total})}\n\n"

        # Persist and emit final state
        serialized = serialize_drafts(finished_drafts)
        save_state(
            contacts=[c.to_dict() for c in contacts],
            drafts=serialized,
            form_data=form_data,
        )
        enriched = drafts_with_gmail_urls(serialized)
        yield f"data: {json.dumps({'done': True, 'drafts': enriched, 'contacts': [c.to_dict() for c in contacts]})}\n\n"

    return Response(stream_with_context(stream()), mimetype="text/event-stream", headers={
        "Cache-Control":    "no-cache",
        "X-Accel-Buffering": "no",
    })


# ─── Draft Editing ──────────────────────────────────────────────────────────

@app.post("/api/drafts/update")
def update_draft():
    """
    Updates a specific draft's subject and body.
    Expects JSON: {email, subject, body}
    """
    data = request.get_json() or {}
    email = data.get("email")
    subject = data.get("subject")
    body = data.get("body")

    if not email:
        return jsonify({"error": "Missing email for draft update."}), 400

    drafts = stored_drafts()
    found = False
    updated_draft = None

    for d in drafts:
        if d["email"] == email:
            if subject is not None:
                d["subject"] = subject
            if body is not None:
                d["body"] = body
            found = True
            updated_draft = d
            break

    if not found:
        return jsonify({"error": f"No draft found for {email}"}), 404

    save_state(drafts=drafts)

    # Return the enriched version of the updated draft (with Gmail URL)
    return jsonify({
        "message": "Draft updated successfully.",
        "draft": drafts_with_gmail_urls([updated_draft])[0],
        "drafts": drafts_with_gmail_urls(drafts)
    })


# ─── SMTP send ────────────────────────────────────────────────────────────────

@app.post("/api/send-smtp")
def send_smtp():
    drafts = stored_drafts()
    form_data = stored_form()

    data = request.get_json() or {}
    sender_email = data.get("sender_email", form_data.get("sender_email", "")).strip()
    form_data["sender_email"] = sender_email
    save_state(form_data=form_data)

    if not drafts:
        return jsonify({"error": "Generate drafts before sending."}), 400
    if not sender_email:
        return jsonify({"error": "Add a sender email before sending through SMTP."}), 400

    draft_objects = [DraftEmail(**d) for d in drafts]
    try:
        updated = send_via_smtp(draft_objects, sender_email=sender_email)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    serialized = serialize_drafts(updated)
    save_state(drafts=serialized)

    # Initialise conversation threads for newly sent emails
    conversation_manager.init_from_drafts(serialized)

    sent    = sum(d.status == "sent"   for d in updated)
    failed  = sum(d.status == "failed" for d in updated)
    return jsonify({
        "message": f"SMTP finished. Sent: {sent}. Failed: {failed}.",
        "drafts":  drafts_with_gmail_urls(serialized),
    })


# ─── Gmail browser automation (SSE) ──────────────────────────────────────────

@app.get("/api/send-gmail")
def send_gmail():
    drafts_data = stored_drafts()
    if not drafts_data:
        return jsonify({"error": "No drafts found. Generate drafts first."}), 400

    limit_str = request.args.get("limit")
    limit = int(limit_str) if limit_str and limit_str.isdigit() else None

    draft_objects = [DraftEmail(**d) for d in drafts_data]

    def generate():
        for event in send_via_gmail_browser(draft_objects, limit=limit):
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("fatal") or event.get("done"):
                break
        serialized = serialize_drafts(draft_objects)
        save_state(drafts=serialized)
        # Bootstrap conversation threads for sent emails
        conversation_manager.init_from_drafts(serialized)

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control":    "no-cache",
        "X-Accel-Buffering": "no",
    })


# ─── Download endpoints ───────────────────────────────────────────────────────

@app.get("/api/download/csv")
def download_csv():
    drafts = stored_drafts()
    if not drafts:
        return jsonify({"error": "Generate drafts before exporting."}), 400

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(drafts[0].keys()))
    writer.writeheader()
    writer.writerows(drafts)

    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8")),
        as_attachment=True,
        download_name="campaign_drafts.csv",
        mimetype="text/csv",
    )


@app.get("/api/download/json")
def download_json():
    drafts = stored_drafts()
    if not drafts:
        return jsonify({"error": "Generate drafts before exporting."}), 400

    return send_file(
        io.BytesIO(json.dumps(drafts, indent=2).encode("utf-8")),
        as_attachment=True,
        download_name="campaign_drafts.json",
        mimetype="application/json",
    )


# ─── Inbox monitor endpoints ──────────────────────────────────────────────────

@app.post("/api/inbox/start")
def inbox_start():
    try:
        inbox_monitor.start()
        return jsonify({"message": "Inbox monitor started.", "status": inbox_monitor.status()})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.post("/api/inbox/stop")
def inbox_stop():
    inbox_monitor.stop()
    return jsonify({"message": "Inbox monitor stopped.", "status": inbox_monitor.status()})


@app.get("/api/inbox/status")
def inbox_status():
    return jsonify(inbox_monitor.status())


# ─── Conversation endpoints ───────────────────────────────────────────────────

@app.get("/api/conversations")
def list_conversations():
    convs = conversation_manager.get_all()
    # Sort by last_activity descending
    convs_sorted = sorted(convs, key=lambda c: c.get("last_activity", ""), reverse=True)
    return jsonify({"conversations": convs_sorted, "total": len(convs_sorted)})


@app.get("/api/conversations/<path:addr>")
def get_conversation(addr: str):
    conv = conversation_manager.get_by_email(addr)
    if conv is None:
        return jsonify({"error": f"No conversation found for {addr}"}), 404
    return jsonify(conv)


@app.post("/api/conversations/<path:addr>/approve")
def approve_reply(addr: str):
    data = request.get_json() or {}
    edited_body = data.get("body")
    try:
        conversation_manager.approve_pending_reply(addr, edited_body)
        return jsonify({"message": "Reply approved and sent."})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.post("/api/conversations/<path:addr>/cancel")
def cancel_reply(addr: str):
    try:
        conversation_manager.cancel_pending_reply(addr)
        return jsonify({"message": "Pending reply cancelled."})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


# ─── Reset ────────────────────────────────────────────────────────────────────

@app.post("/api/reset")
def reset():
    inbox_monitor.stop()
    reset_state()
    return jsonify({"message": "Campaign state cleared."})


# ─── Frontend SPA serving ─────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    # If the requested route doesn't match and not an API call, serve the SPA
    if not request.path.startswith("/api/"):
        return app.send_static_file("index.html")
    return jsonify({"error": "Not found"}), 404

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return app.send_static_file(path)
    return app.send_static_file("index.html")
