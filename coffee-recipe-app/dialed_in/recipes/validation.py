from __future__ import annotations

import math
import uuid
from typing import Any

from ..scraping.coffee_detection import origin_summary, parse_legacy_origin
from ..utils import normalize_text, utc_now


def normalize_grind_setting(value: Any) -> str:
    """Validate a numeric grind setting while retaining TEXT-column compatibility."""
    if value in (None, ""):
        return ""

    raw = normalize_text(value).replace(",", ".")
    try:
        number = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("Grind setting must be a number.") from exc

    if not math.isfinite(number) or not 0 <= number <= 100:
        raise ValueError("Grind setting must be between 0 and 100.")

    return f"{number:.4f}".rstrip("0").rstrip(".")


def read_grind_setting(value: Any) -> str:
    """Read legacy values without breaking the complete recipe list."""
    try:
        return normalize_grind_setting(value)
    except ValueError:
        return ""


def validate_recipe_payload(
    payload: dict[str, Any],
    recipe_id: str | None = None,
) -> dict[str, Any]:
    name = normalize_text(payload.get("name"))
    if not name:
        raise ValueError("The coffee name cannot be empty.")

    roast_aliases = {
        "light": "light",
        "medium": "medium",
        "dark": "dark",
        "hell": "light",
        "mittel": "medium",
        "dunkel": "dark",
    }
    status_aliases = {
        "active": "active",
        "empty": "empty",
        "wishlist": "wishlist",
        "aktiv": "active",
        "leer": "empty",
        "wunschliste": "wishlist",
    }

    roast = roast_aliases.get(str(payload.get("roast", "medium")).lower())
    status = status_aliases.get(str(payload.get("status", "active")).lower())
    if roast is None:
        raise ValueError("Invalid roast level.")
    if status is None:
        raise ValueError("Invalid status.")

    origin_country = normalize_text(payload.get("originCountry"))[:50]
    origin_region = normalize_text(payload.get("originRegion"))[:60]
    blend = normalize_text(payload.get("blend"))[:80]

    if not (origin_country or origin_region or blend) and payload.get("origin"):
        origin_country, origin_region, blend = parse_legacy_origin(
            str(payload.get("origin"))
        )

    dose = float(payload.get("dose", 18))
    yield_amount = float(payload.get("yield", 36))
    time_seconds = int(float(payload.get("time", 28)))
    rating = float(payload.get("rating", 0) or 0)
    temp_value = payload.get("temp")
    temp = float(temp_value) if temp_value not in (None, "") else None
    grind = normalize_grind_setting(payload.get("grind"))

    if not 1 <= dose <= 40:
        raise ValueError("Dose must be between 1 and 40 g.")
    if not 1 <= yield_amount <= 100:
        raise ValueError("Yield must be between 1 and 100 g.")
    if not 1 <= time_seconds <= 120:
        raise ValueError("Time must be between 1 and 120 seconds.")
    if not 0 <= rating <= 5:
        raise ValueError("Rating must be between 0 and 5.")
    if temp is not None and not 70 <= temp <= 110:
        raise ValueError("Temperature must be between 70 and 110 °C.")

    return {
        "id": recipe_id or str(payload.get("id") or uuid.uuid4()),
        "name": name[:60],
        "roaster": normalize_text(payload.get("roaster"))[:60],
        "originCountry": origin_country,
        "originRegion": origin_region,
        "blend": blend,
        "origin": origin_summary(origin_country, origin_region, blend)[:160],
        "roast": roast,
        "status": status,
        "dose": dose,
        "yield": yield_amount,
        "time": time_seconds,
        "grind": grind,
        "temp": temp,
        "rating": rating,
        "orderUrl": normalize_text(payload.get("orderUrl"))[:500],
        "notes": normalize_text(payload.get("notes"))[:500],
        "favorite": bool(payload.get("favorite", False)),
        "updatedAt": utc_now(),
    }


# Compatibility alias while the refactor is being introduced.
clean_recipe = validate_recipe_payload
