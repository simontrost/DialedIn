from __future__ import annotations

import re
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


def _origin_altitudes(payload: dict[str, Any]) -> str:
    raw = payload.get("originAltitude", payload.get("originLatitude", ""))
    if raw is None:
        return ""
    value = str(raw).strip()
    if len(value) > 300:
        raise ValueError("originAltitude is too long.")
    if not value:
        return ""

    parts = re.split(r"\s*[;,]\s*", value)
    normalized: list[str] = []
    has_value = False
    for item in parts:
        item = item.strip()
        if not item:
            normalized.append("")
            continue
        try:
            altitude = float(item)
        except (TypeError, ValueError) as error:
            raise ValueError("Every altitude must be a number between -500 and 10000 metres.") from error
        if altitude < -500 or altitude > 10000:
            raise ValueError("Every altitude must be between -500 and 10000 metres.")
        has_value = True
        normalized.append(format(altitude, ".8g"))

    return ", ".join(normalized) if has_value else ""


def _sca_score(payload: dict[str, Any]) -> float | None:
    raw = payload.get("scaScore", "")
    if raw in (None, ""):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError) as error:
        raise ValueError("SCA score must be a number between 0 and 100.") from error
    if value < 0 or value > 100:
        raise ValueError("SCA score must be between 0 and 100.")
    return round(value, 1)



def _inventory(payload: dict[str, Any]) -> tuple[float | None, float | None]:
    raw_size = payload.get("bagSizeGrams", "")
    if raw_size in (None, ""):
        raw_remaining = payload.get("remainingGrams", "")
        if raw_remaining not in (None, ""):
            raise ValueError("Choose a bag size before setting the remaining amount.")
        return None, None

    try:
        bag_size = float(raw_size)
    except (TypeError, ValueError) as error:
        raise ValueError("Bag size must be a number of grams.") from error
    if bag_size <= 0 or bag_size > 100000:
        raise ValueError("Bag size must be between 1 and 100000 grams.")

    raw_remaining = payload.get("remainingGrams", bag_size)
    if raw_remaining in (None, ""):
        remaining = bag_size
    else:
        try:
            remaining = float(raw_remaining)
        except (TypeError, ValueError) as error:
            raise ValueError("Remaining beans must be a number of grams.") from error
    if remaining < 0:
        raise ValueError("Remaining beans cannot be negative.")
    if remaining > bag_size:
        raise ValueError("Remaining beans cannot exceed the bag size.")

    return round(bag_size, 2), round(remaining, 2)


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
        strength = float(payload.get("strength") or 0)
    except (TypeError, ValueError) as error:
        raise ValueError("strength must be a number from 0 to 5.") from error
    if strength < 0 or strength > 5 or strength * 2 != int(strength * 2):
        raise ValueError("strength must be between 0 and 5 in half-step increments.")

    taste_balance = _text(payload, "tasteBalance", 30)
    if taste_balance not in VALID_TASTE_BALANCES:
        raise ValueError("Invalid acidity / bitterness value.")

    bag_size_grams, remaining_grams = _inventory(payload)

    return {
        "name": name,
        "roaster": _text(payload, "roaster", 80),
        "originCountry": _normalize_country(_text(payload, "originCountry", 100)),
        "originRegion": _text(payload, "originRegion", 100),
        "originAltitude": _origin_altitudes(payload),
        "blend": _text(payload, "blend", 80),
        "scaScore": _sca_score(payload),
        "roast": roast,
        "status": status,
        "orderUrl": _text(payload, "orderUrl", 500),
        "notes": _text(payload, "notes", 1000),
        "flavorNotes": _flavor_notes(payload),
        "strength": strength,
        "tasteBalance": taste_balance,
        "decaf": bool(payload.get("decaf", False)),
        "isGround": bool(payload.get("isGround", False)),
        "bagSizeGrams": bag_size_grams,
        "remainingGrams": remaining_grams,
        "favorite": bool(payload.get("favorite", False)),
    }
