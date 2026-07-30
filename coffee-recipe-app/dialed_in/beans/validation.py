from __future__ import annotations

from typing import Any

VALID_ROASTS = {"light", "medium", "dark"}
VALID_STATUSES = {"active", "empty", "wishlist"}
VALID_TASTE_BALANCES = {"", "very_acidic", "acidic", "little_acidic", "balanced", "little_bitter", "bitter", "very_bitter"}


COUNTRY_ALIASES = {
    "dr kongo": "Democratic Republic of the Congo",
    "dr congo": "Democratic Republic of the Congo",
    "democratic republic of congo": "Democratic Republic of the Congo",
    "kongo-kinshasa": "Democratic Republic of the Congo",
}


def _normalize_country(value: str) -> str:
    return COUNTRY_ALIASES.get(value.lower(), value)


def _text(payload: dict[str, Any], key: str, maximum: int, default: str = "") -> str:
    value = payload.get(key, default)
    if value is None:
        return default
    value = str(value).strip()
    if len(value) > maximum:
        raise ValueError(f"{key} is too long.")
    return value


def _flavor_notes(payload: dict[str, Any]) -> list[str]:
    value = payload.get("flavorNotes", [])
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("flavorNotes must be a list.")
    if len(value) > 20:
        raise ValueError("A bean can have at most 20 flavor notes.")

    notes: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            raise ValueError("Every flavor note must be text.")
        note = item.strip()
        if not note:
            continue
        if len(note) > 40:
            raise ValueError("A flavor note is too long.")
        key = note.casefold()
        if key in seen:
            continue
        seen.add(key)
        notes.append(note)
    return notes


def validate_bean(payload: dict[str, Any]) -> dict[str, Any]:
    name = _text(payload, "name", 80)
    if not name:
        raise ValueError("Coffee / bean name is required.")

    roast = _text(payload, "roast", 20, "medium") or "medium"
    status = _text(payload, "status", 20, "active") or "active"
    if roast not in VALID_ROASTS:
        raise ValueError("Invalid roast level.")
    if status not in VALID_STATUSES:
        raise ValueError("Invalid bean status.")

    try:
        strength = int(payload.get("strength") or 0)
    except (TypeError, ValueError) as error:
        raise ValueError("strength must be a whole number from 0 to 5.") from error
    if strength < 0 or strength > 5:
        raise ValueError("strength must be between 0 and 5.")

    taste_balance = _text(payload, "tasteBalance", 30)
    if taste_balance not in VALID_TASTE_BALANCES:
        raise ValueError("Invalid acidity / bitterness value.")

    return {
        "name": name,
        "roaster": _text(payload, "roaster", 80),
        "originCountry": _normalize_country(_text(payload, "originCountry", 100)),
        "originRegion": _text(payload, "originRegion", 100),
        "blend": _text(payload, "blend", 80),
        "roast": roast,
        "status": status,
        "orderUrl": _text(payload, "orderUrl", 500),
        "notes": _text(payload, "notes", 1000),
        "flavorNotes": _flavor_notes(payload),
        "strength": strength,
        "tasteBalance": taste_balance,
        "decaf": bool(payload.get("decaf", False)),
        "favorite": bool(payload.get("favorite", False)),
    }
