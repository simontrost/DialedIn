from __future__ import annotations

from typing import Any

from ..brewing_methods import get_method

COMMON_KEYS = {
    "dose",
    "beverageYield",
    "targetTime",
    "grind",
    "temperature",
    "pressure",
    "waterAmount",
}


def _text(payload: dict[str, Any], key: str, maximum: int, default: str = "") -> str:
    value = payload.get(key, default)
    if value is None:
        return default
    value = str(value).strip()
    if len(value) > maximum:
        raise ValueError(f"{key} is too long.")
    return value


def _coerce_number(value: Any, field: dict[str, Any]) -> float | None:
    if value in (None, ""):
        if field.get("required"):
            raise ValueError(f"{field['label']} is required.")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field['label']} must be a number.") from error

    minimum = field.get("min")
    maximum = field.get("max")
    if minimum is not None and number < minimum:
        raise ValueError(f"{field['label']} is below the allowed minimum.")
    if maximum is not None and number > maximum:
        raise ValueError(f"{field['label']} is above the allowed maximum.")
    return number




def _coerce_boolean(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off", ""}:
        return False
    return default


def _condition_matches(values: dict[str, Any], condition: Any) -> bool:
    if not isinstance(condition, dict):
        return True
    key = str(condition.get("key") or "")
    if not key:
        return True
    return values.get(key) == condition.get("equals")

def _validate_values(method: dict[str, Any], raw_values: Any) -> dict[str, Any]:
    values = raw_values if isinstance(raw_values, dict) else {}
    clean: dict[str, Any] = {}
    for field in method["fields"]:
        key = field["key"]
        value = values.get(key, field.get("default"))
        if field["type"] == "number":
            clean[key] = _coerce_number(value, field)
        elif field["type"] == "select":
            allowed = {option["value"] for option in field.get("options", [])}
            selected = str(value or field.get("default", ""))
            if selected and selected not in allowed:
                raise ValueError(f"Invalid value for {field['label']}.")
            clean[key] = selected
        elif field["type"] == "boolean":
            clean[key] = _coerce_boolean(value, bool(field.get("default", False)))
        else:
            clean[key] = str(value or "").strip()

    for field in method["fields"]:
        key = field["key"]
        visible_when = field.get("visibleWhen")
        if visible_when and not _condition_matches(clean, visible_when):
            clean[key] = None
            continue
        required_when = field.get("requiredWhen")
        if required_when and _condition_matches(clean, required_when) and clean.get(key) in (None, ""):
            raise ValueError(f"{field['label']} is required.")
    return clean


def _validate_steps(raw_steps: Any, supports_steps: bool) -> list[dict[str, Any]]:
    if not supports_steps:
        return []
    if raw_steps is None:
        return []
    if not isinstance(raw_steps, list):
        raise ValueError("Recipe steps must be a list.")
    if len(raw_steps) > 30:
        raise ValueError("A recipe can contain at most 30 steps.")

    clean: list[dict[str, Any]] = []
    for index, step in enumerate(raw_steps, start=1):
        if not isinstance(step, dict):
            raise ValueError(f"Step {index} is invalid.")
        title = str(step.get("title", f"Step {index}")).strip()[:80] or f"Step {index}"
        note = str(step.get("note", "")).strip()[:300]
        try:
            water = float(step.get("waterAmount") or 0)
            wait = float(step.get("waitSeconds") or 0)
        except (TypeError, ValueError) as error:
            raise ValueError(f"Step {index} contains an invalid amount or wait time.") from error
        if water < 0 or wait < 0:
            raise ValueError(f"Step {index} cannot use negative values.")
        clean.append(
            {
                "title": title,
                "waterAmount": water,
                "waitSeconds": wait,
                "note": note,
            }
        )
    return clean


def validate_brew_recipe(payload: dict[str, Any]) -> dict[str, Any]:
    bean_id = _text(payload, "beanId", 80)
    if not bean_id:
        raise ValueError("Select a bean.")

    method_id = _text(payload, "method", 40, "espresso") or "espresso"
    method = get_method(method_id)
    if not method:
        raise ValueError("Unknown brewing method.")

    name = _text(payload, "name", 80, method["name"]) or method["name"]
    return {
        "beanId": bean_id,
        "name": name,
        "method": method_id,
        "values": _validate_values(method, payload.get("values")),
        "steps": _validate_steps(payload.get("steps"), method["supportsSteps"]),
        "notes": _text(payload, "notes", 1500),
        "favorite": bool(payload.get("favorite", False)),
    }
