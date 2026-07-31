from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# A seven-step extraction-taste scale plus an unjudged default. The two legacy
# values remain accepted so existing measurements can still be loaded/edited.
VALID_TASTES = {
    "very_bitter",
    "bitter",
    "little_bitter",
    "balanced",
    "little_sour",
    "sour",
    "very_sour",
    "neutral",
    "astringent",
    "hollow",
}


def _number(
    payload: dict[str, Any],
    key: str,
    *,
    required: bool = False,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float | None:
    value = payload.get(key)
    if value in (None, ""):
        if required:
            raise ValueError(f"{key} is required.")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{key} must be a number.") from error
    if minimum is not None and number < minimum:
        raise ValueError(f"{key} is below the allowed minimum.")
    if maximum is not None and number > maximum:
        raise ValueError(f"{key} is above the allowed maximum.")
    return number


def _timestamp(value: Any) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Invalid brewedAt timestamp.") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")


def validate_log(payload: dict[str, Any]) -> dict[str, Any]:
    bean_id = str(payload.get("beanId") or "").strip()
    recipe_id = str(payload.get("brewRecipeId") or "").strip()
    if not bean_id or not recipe_id:
        raise ValueError("Select a bean and recipe.")

    taste = str(payload.get("taste") or "neutral").strip()
    if taste not in VALID_TASTES:
        raise ValueError("Invalid taste value.")

    notes = str(payload.get("notes") or "").strip()
    if len(notes) > 1000:
        raise ValueError("Notes are too long.")

    return {
        "beanId": bean_id,
        "brewRecipeId": recipe_id,
        "grind": _number(payload, "grind", minimum=0, maximum=500),
        "dose": _number(payload, "dose", minimum=0, maximum=1000),
        "beverageYield": _number(payload, "beverageYield", minimum=0, maximum=10000),
        "time": _number(payload, "time", required=True, minimum=0.1, maximum=10000),
        "taste": taste,
        "rating": _number(payload, "rating", minimum=0, maximum=5),
        "valid": bool(payload.get("valid", True)),
        "notes": notes,
        "brewedAt": _timestamp(payload.get("brewedAt")),
    }
