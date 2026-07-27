from __future__ import annotations

from typing import Any

VALID_ROASTS = {"light", "medium", "dark"}
VALID_STATUSES = {"active", "empty", "wishlist"}


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
        "favorite": bool(payload.get("favorite", False)),
    }
