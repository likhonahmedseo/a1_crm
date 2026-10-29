from __future__ import annotations

import os
from typing import Literal

from dotenv import load_dotenv

load_dotenv(override=True)

ReplyClass = Literal["interested", "question", "objection", "not_interested", "out_of_office", "other"]


def _client():
    """Return an OpenAI client, raising a clear error if the key is missing."""
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to your .env file:\n"
            "OPENAI_API_KEY=sk-..."
        )
    return OpenAI(api_key=api_key)


# ─── Outbound email generation ────────────────────────────────────────────────

def generate_email_copy(contact_dict: dict, config_dict: dict) -> tuple[str, str]:
    """
    Generate a fully personalized outbound email for one contact using GPT-4o.
    Returns (subject, body).
    """
    client = _client()

    contact_lines = [
        f"- Email: {contact_dict.get('email', '')}",
        f"- First name: {contact_dict.get('first_name', '') or 'Unknown'}",
        f"- Last name: {contact_dict.get('last_name', '')}",
        f"- Company: {contact_dict.get('company', '') or 'their company'}",
        f"- Role: {contact_dict.get('role', '')}",
        f"- Website: {contact_dict.get('website', '')}",
        f"- Notes: {contact_dict.get('notes', '')}",
    ]
    contact_info = "\n".join(contact_lines)

    signature = "\n".join(filter(None, [
        config_dict.get("sender_name", ""),
        config_dict.get("sender_company", ""),
        config_dict.get("signature", ""),
    ]))

    system_prompt = (
        f"You are a world-class B2B copywriter writing cold outreach emails on behalf of "
        f"{config_dict.get('sender_name', 'the sender')} from {config_dict.get('sender_company', 'the company')}.\n\n"
        f"Writing style: {config_dict.get('tone', 'professional')}, concise, and genuine. "
        "Never use generic phrases like 'I hope this finds you well' or 'I wanted to reach out'. "
        "Every sentence must earn its place.\n\n"
        f"Signature block to append:\n{signature}"
    )

    user_prompt = (
        f"Write a cold outreach email using the context below.\n\n"
        f"Mission / value proposition: {config_dict.get('mission', '')}\n"
        f"Offer: {config_dict.get('offer', '')}\n"
        f"Call to action: {config_dict.get('call_to_action', '')}\n\n"
        f"Contact:\n{contact_info}\n\n"
        "Respond in EXACTLY this format (no extra text):\n"
        "SUBJECT: <subject line>\n"
        "BODY:\n<email body>\n\n"
        "Rules:\n"
        "- Subject: compelling, specific, under 60 chars\n"
        "- Body: under 200 words, personalised to the contact's company/role/notes\n"
        "- End the body with the signature block\n"
        "- No fluff openers"
    )

    response = _client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=700,
    )

    return _parse_subject_body(response.choices[0].message.content.strip())


# ─── Reply classification ─────────────────────────────────────────────────────

def classify_reply(reply_text: str) -> ReplyClass:
    """
    Classify the intent of an incoming reply into one of the known categories.
    Uses the cheaper gpt-4o-mini for cost efficiency.
    """
    client = _client()

    categories = (
        "interested      — wants to learn more, book a call, or is open to discussion\n"
        "question        — has a specific question before deciding\n"
        "objection       — concern about price, timing, relevance, etc.\n"
        "not_interested  — clearly doesn't want to continue, says no / remove me\n"
        "out_of_office   — automated out-of-office or vacation reply\n"
        "other           — doesn't fit any of the above"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify the email reply below into exactly one category. "
                    "Respond with ONLY the category name, nothing else.\n\n"
                    f"Categories:\n{categories}"
                ),
            },
            {
                "role": "user",
                "content": f"Reply to classify:\n---\n{reply_text[:1500]}\n---",
            },
        ],
        temperature=0,
        max_tokens=10,
    )

    raw = response.choices[0].message.content.strip().lower().replace(" ", "_")
    valid: set[ReplyClass] = {"interested", "question", "objection", "not_interested", "out_of_office", "other"}
    return raw if raw in valid else "other"  # type: ignore[return-value]


# ─── Auto-reply generation ────────────────────────────────────────────────────

def generate_auto_reply(
    thread_messages: list[dict],
    latest_reply: str,
    classification: ReplyClass,
    config_dict: dict,
) -> str:
    """
    Generate a human-sounding auto-reply given the full conversation thread.
    Returns the email body text, or the special string "SKIP" if no reply should be sent.
    """
    if classification == "out_of_office":
        return "SKIP"

    instruction_map: dict[str, str] = {
        "interested": (
            "They're interested! Move the conversation forward. "
            "Suggest a specific day/time for a call, or ask a qualifying question. "
            "Be warm and enthusiastic but not pushy."
        ),
        "question": (
            "They have a question. Answer it clearly and helpfully. "
            "Then make it easy for them to take the next step."
        ),
        "objection": (
            "They have a concern or objection. Acknowledge it genuinely, "
            "address it with empathy, and offer a low-commitment next step."
        ),
        "other": (
            "Respond naturally and helpfully to keep the conversation going."
        ),
    }
    instruction = instruction_map.get(classification, instruction_map["other"])

    # Build thread context (last 6 messages to keep prompt lean)
    thread_formatted = "\n\n---\n".join(
        f"[{'YOU' if m['direction'] == 'sent' else 'THEM'}]\n{m['body']}"
        for m in thread_messages[-6:]
    )

    signature = "\n".join(filter(None, [
        config_dict.get("sender_name", ""),
        config_dict.get("sender_company", ""),
        config_dict.get("signature", ""),
    ]))

    system_prompt = (
        f"You ARE {config_dict.get('sender_name', 'the sender')} from "
        f"{config_dict.get('sender_company', 'the company')}. "
        f"You are replying to an email thread as yourself. "
        f"Writing style: {config_dict.get('tone', 'professional')}, concise, completely human. "
        "Never sound like a bot or use hollow phrases.\n\n"
        f"Your signature:\n{signature}"
    )

    user_prompt = (
        f"Full thread so far:\n{thread_formatted}\n\n"
        f"Their latest reply:\n{latest_reply}\n\n"
        f"Classification: {classification}\n"
        f"What to do: {instruction}\n\n"
        "Write ONLY the reply body text. No subject line. "
        "Under 150 words. Sound completely human. End with your signature."
    )

    client = _client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.75,
        max_tokens=450,
    )

    return response.choices[0].message.content.strip()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_subject_body(raw: str) -> tuple[str, str]:
    """Parse SUBJECT: ... BODY: ... from the model response."""
    subject = ""
    body_lines: list[str] = []
    in_body = False

    for line in raw.split("\n"):
        if line.upper().startswith("SUBJECT:"):
            subject = line[len("SUBJECT:"):].strip()
        elif line.upper().startswith("BODY:"):
            in_body = True
        elif in_body:
            body_lines.append(line)

    body = "\n".join(body_lines).strip()

    # Fallback if format wasn't followed
    if not subject or not body:
        parts = raw.split("\n\n", 1)
        subject = parts[0].replace("SUBJECT:", "").strip()
        body = parts[1].strip() if len(parts) > 1 else raw

    return subject, body
