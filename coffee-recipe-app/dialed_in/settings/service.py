from __future__ import annotations

import sqlite3
from typing import Any

from ..utils import normalize_text

DEFAULT_MACHINE = "Gaggia Classic Evo Pro E24"
DEFAULT_GRINDER = "Turin G-Micron DF64P"
DEFAULT_THEME = "light"
VALID_THEMES = {"light", "dark"}


def get_settings(db: sqlite3.Connection) -> dict[str, str]:
    rows = db.execute("SELECT key, value FROM settings").fetchall()
    return {row["key"]: row["value"] for row in rows}


def validate_settings(payload: dict[str, Any]) -> dict[str, str]:
    theme = normalize_text(payload.get("theme")).lower()
    if theme not in VALID_THEMES:
        theme = DEFAULT_THEME

    return {
        "machine": normalize_text(payload.get("machine"))[:80] or DEFAULT_MACHINE,
        "grinder": normalize_text(payload.get("grinder"))[:80] or DEFAULT_GRINDER,
        "theme": theme,
    }


def save_settings(
    db: sqlite3.Connection,
    settings: dict[str, str],
) -> None:
    db.executemany(
        """
        INSERT INTO settings(key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        [
            ("machine", settings["machine"]),
            ("grinder", settings["grinder"]),
            ("theme", settings["theme"]),
        ],
    )
