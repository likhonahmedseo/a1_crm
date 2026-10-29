from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[2]
RUNTIME_DIR = BASE_DIR / "data" / "runtime"
STATE_FILE = RUNTIME_DIR / "campaign_state.json"

_state_lock = threading.Lock()


def load_state() -> dict[str, Any]:
    with _state_lock:
        if not STATE_FILE.exists():
            return {"contacts": [], "drafts": [], "form_data": {}, "conversations": []}

        try:
            state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {"contacts": [], "drafts": [], "form_data": {}, "conversations": []}
            
        state.setdefault("conversations", [])
        return state


def save_state(
    *,
    contacts: list[dict[str, Any]] | None = None,
    drafts: list[dict[str, Any]] | None = None,
    form_data: dict[str, Any] | None = None,
    conversations: list[dict[str, Any]] | None = None,
) -> None:
    with _state_lock:
        if not STATE_FILE.exists():
            current = {"contacts": [], "drafts": [], "form_data": {}, "conversations": []}
        else:
            try:
                current = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                current = {"contacts": [], "drafts": [], "form_data": {}, "conversations": []}

        if contacts is not None:
            current["contacts"] = contacts
        if drafts is not None:
            current["drafts"] = drafts
        if form_data is not None:
            current["form_data"] = form_data
        if conversations is not None:
            current["conversations"] = conversations

        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        with STATE_FILE.open("w", encoding="utf-8") as handle:
            json.dump(current, handle, indent=2)


def reset_state() -> None:
    with _state_lock:
        if STATE_FILE.exists():
            STATE_FILE.unlink()

