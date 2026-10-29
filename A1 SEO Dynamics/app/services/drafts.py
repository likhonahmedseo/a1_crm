from __future__ import annotations

from textwrap import dedent

from app.models import CampaignConfig, Contact, DraftEmail


def generate_drafts(contacts: list[Contact], config: CampaignConfig) -> list[DraftEmail]:
    return [build_draft(contact, config) for contact in contacts]


def build_draft(contact: Contact, config: CampaignConfig) -> DraftEmail:
    first_name = contact.first_name or "there"
    company_text = contact.company or "your team"
    role_text = f" as {contact.role}" if contact.role else ""
    notes_sentence = ""

    if contact.notes:
        notes_sentence = f" I also noticed: {contact.notes.strip()}."

    subject = build_subject(contact, config)

    opener_map = {
        "professional": f"Hi {first_name},",
        "friendly": f"Hello {first_name},",
        "direct": f"{first_name},",
        "warm": f"Hi {first_name},",
    }
    opener = opener_map.get(config.tone.lower(), f"Hi {first_name},")

    body = dedent(
        f"""
        {opener}

        I’m reaching out from {config.sender_company or config.sender_name} because {config.mission.strip()}.

        Based on what I saw about {company_text}{role_text}, I think {config.offer.strip()} could be relevant for you.{notes_sentence}

        If it sounds useful, {config.call_to_action.strip()}.

        {build_signature(config)}
        """
    ).strip()

    return DraftEmail(
        email=contact.email,
        first_name=contact.first_name,
        company=contact.company,
        subject=subject,
        body=body,
    )


def build_subject(contact: Contact, config: CampaignConfig) -> str:
    company = contact.company.strip()
    mission = config.mission.strip()

    if company:
        return f"Idea for {company} related to {shorten_text(mission, 36)}"
    return shorten_text(f"Quick idea related to {mission}", 58)


def build_signature(config: CampaignConfig) -> str:
    signature_lines = [
        config.sender_name.strip() or "Your Name",
        config.sender_company.strip(),
        config.signature.strip(),
    ]
    return "\n".join(line for line in signature_lines if line)


def shorten_text(text: str, limit: int) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."
