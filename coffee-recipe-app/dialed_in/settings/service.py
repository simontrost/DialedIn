from __future__ import annotations

import sqlite3
from typing import Any

from ..utils import normalize_text

DEFAULT_MACHINE = "Gaggia Classic Evo Pro E24"
DEFAULT_GRINDER = "Turin G-Micron DF64P"
DEFAULT_THEME = "light"
DEFAULT_GRIND_MIN = 1.0
DEFAULT_GRIND_MAX = 50.0
VALID_THEMES = {"light", "dark"}


def _as_float(value: Any, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _as_bool(value: Any, fallback: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return fallback
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def get_settings(db: sqlite3.Connection) -> dict[str, Any]:
    rows = db.execute("SELECT key, value FROM settings").fetchall()
    raw = {row["key"]: row["value"] for row in rows}
    grind_min = _as_float(raw.get("grindMin"), DEFAULT_GRIND_MIN)
    grind_max = _as_float(raw.get("grindMax"), DEFAULT_GRIND_MAX)
    if grind_max <= grind_min:
        grind_min, grind_max = DEFAULT_GRIND_MIN, DEFAULT_GRIND_MAX
    theme = str(raw.get("theme") or DEFAULT_THEME).lower()
    if theme not in VALID_THEMES:
        theme = DEFAULT_THEME
    return {
        "machine": normalize_text(raw.get("machine"))[:80] or DEFAULT_MACHINE,
        "grinder": normalize_text(raw.get("grinder"))[:80] or DEFAULT_GRINDER,
        "theme": theme,
        "grindMin": grind_min,
        "grindMax": grind_max,
        "machineTemperatureControl": _as_bool(raw.get("machineTemperatureControl"), False),
        "machinePressureControl": _as_bool(raw.get("machinePressureControl"), False),
        "machineFlowControl": _as_bool(raw.get("machineFlowControl"), False),
    }


def validate_settings(payload: dict[str, Any]) -> dict[str, Any]:
    theme = normalize_text(payload.get("theme")).lower()
    if theme not in VALID_THEMES:
        theme = DEFAULT_THEME

    grind_min = _as_float(payload.get("grindMin"), DEFAULT_GRIND_MIN)
    grind_max = _as_float(payload.get("grindMax"), DEFAULT_GRIND_MAX)
    if grind_min < 0:
        raise ValueError("The minimum grind setting cannot be negative.")
    if grind_max <= grind_min:
        raise ValueError("The maximum grind setting must be greater than the minimum.")
    if grind_max - grind_min > 10000:
        raise ValueError("The grinder range is too large.")

    return {
        "machine": normalize_text(payload.get("machine"))[:80] or DEFAULT_MACHINE,
        "grinder": normalize_text(payload.get("grinder"))[:80] or DEFAULT_GRINDER,
        "theme": theme,
        "grindMin": round(grind_min, 3),
        "grindMax": round(grind_max, 3),
        "machineTemperatureControl": _as_bool(payload.get("machineTemperatureControl")),
        "machinePressureControl": _as_bool(payload.get("machinePressureControl")),
        "machineFlowControl": _as_bool(payload.get("machineFlowControl")),
    }


def save_settings(db: sqlite3.Connection, settings: dict[str, Any]) -> None:
    pairs = [
        ("machine", settings["machine"]),
        ("grinder", settings["grinder"]),
        ("theme", settings["theme"]),
        ("grindMin", str(settings["grindMin"])),
        ("grindMax", str(settings["grindMax"])),
        ("machineTemperatureControl", "true" if settings["machineTemperatureControl"] else "false"),
        ("machinePressureControl", "true" if settings["machinePressureControl"] else "false"),
        ("machineFlowControl", "true" if settings["machineFlowControl"] else "false"),
    ]
    db.executemany(
        """
        INSERT INTO settings(key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        pairs,
    )
