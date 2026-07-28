from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from flask import current_app

from .settings.service import DEFAULT_GRINDER, DEFAULT_MACHINE, DEFAULT_THEME


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def db_connection():
    db_path = current_app.config["DB_PATH"]
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _legacy_recipe_columns(db: sqlite3.Connection) -> set[str]:
    return {row["name"] for row in db.execute("PRAGMA table_info(recipes)").fetchall()}


def _ensure_legacy_recipe_columns(db: sqlite3.Connection) -> None:
    additions = {
        "origin_country": "TEXT NOT NULL DEFAULT ''",
        "origin_region": "TEXT NOT NULL DEFAULT ''",
        "blend": "TEXT NOT NULL DEFAULT ''",
    }
    existing = _legacy_recipe_columns(db)
    for name, definition in additions.items():
        if name not in existing:
            db.execute(f"ALTER TABLE recipes ADD COLUMN {name} {definition}")


def _bean_columns(db: sqlite3.Connection) -> set[str]:
    return {row["name"] for row in db.execute("PRAGMA table_info(beans)").fetchall()}


def _ensure_bean_columns(db: sqlite3.Connection) -> None:
    additions = {
        "flavor_notes_json": "TEXT NOT NULL DEFAULT '[]'",
    }
    existing = _bean_columns(db)
    for name, definition in additions.items():
        if name not in existing:
            db.execute(f"ALTER TABLE beans ADD COLUMN {name} {definition}")


def _safe_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _legacy_id(prefix: str, value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"dialed-in:{prefix}:{value}"))


def _migrate_legacy_recipes(db: sqlite3.Connection) -> int:
    marker = db.execute(
        "SELECT value FROM settings WHERE key = 'beans_recipe_migration_v1'"
    ).fetchone()
    if marker:
        return 0

    rows = db.execute("SELECT * FROM recipes ORDER BY updated_at ASC").fetchall()
    migrated = 0
    for row in rows:
        bean_id = _legacy_id("bean", row["id"])
        brew_id = _legacy_id("espresso", row["id"])
        timestamp = row["updated_at"] or utc_now()
        country = row["origin_country"] if "origin_country" in row.keys() else ""
        region = row["origin_region"] if "origin_region" in row.keys() else ""
        blend = row["blend"] if "blend" in row.keys() else ""

        db.execute(
            """
            INSERT OR IGNORE INTO beans (
                id, name, roaster, origin_country, origin_region, blend,
                roast, status, order_url, notes, flavor_notes_json, favorite,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)
            """,
            (
                bean_id,
                row["name"],
                row["roaster"],
                country,
                region,
                blend,
                row["roast"],
                row["status"],
                row["order_url"],
                "",
                row["favorite"],
                timestamp,
                timestamp,
            ),
        )

        values = {
            "dose": row["dose"],
            "beverageYield": row["yield_amount"],
            "targetTime": row["time_seconds"],
            "grind": _safe_float(row["grind"]),
            "temperature": row["temp"],
            "pressure": 9,
        }
        db.execute(
            """
            INSERT OR IGNORE INTO brew_recipes (
                id, bean_id, name, method, values_json, steps_json, notes,
                favorite, created_at, updated_at
            ) VALUES (?, ?, ?, 'espresso', ?, '[]', ?, ?, ?, ?)
            """,
            (
                brew_id,
                bean_id,
                "Espresso",
                json.dumps(values, ensure_ascii=False),
                row["notes"],
                row["favorite"],
                timestamp,
                timestamp,
            ),
        )
        migrated += 1

    db.execute(
        "INSERT OR REPLACE INTO settings(key, value) VALUES ('beans_recipe_migration_v1', ?)",
        (utc_now(),),
    )
    return migrated


def _seed_new_database(db: sqlite3.Connection) -> None:
    bean_count = db.execute("SELECT COUNT(*) AS count FROM beans").fetchone()["count"]
    legacy_count = db.execute("SELECT COUNT(*) AS count FROM recipes").fetchone()["count"]
    if bean_count or legacy_count:
        return

    timestamp = utc_now()
    bean_id = str(uuid.uuid4())
    recipe_id = str(uuid.uuid4())
    db.execute(
        """
        INSERT INTO beans (
            id, name, roaster, origin_country, origin_region, blend, roast,
            status, order_url, notes, flavor_notes_json, favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1, ?, ?)
        """,
        (
            bean_id,
            "House Blend 70/30",
            "Example Roastery",
            "Multiple origins",
            "",
            "70% Arabica / 30% Robusta",
            "dark",
            "active",
            "Example bean – replace it with your own coffee.",
            json.dumps(["Chocolate", "Caramel"], ensure_ascii=False),
            timestamp,
            timestamp,
        ),
    )
    db.execute(
        """
        INSERT INTO brew_recipes (
            id, bean_id, name, method, values_json, steps_json, notes,
            favorite, created_at, updated_at
        ) VALUES (?, ?, 'Espresso', 'espresso', ?, '[]', ?, 1, ?, ?)
        """,
        (
            recipe_id,
            bean_id,
            json.dumps(
                {
                    "dose": 18,
                    "beverageYield": 38,
                    "targetTime": 28,
                    "grind": 17.5,
                    "temperature": 93,
                    "pressure": 9,
                }
            ),
            "Chocolatey and full-bodied.",
            timestamp,
            timestamp,
        ),
    )


def init_db() -> None:
    with db_connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                roaster TEXT NOT NULL DEFAULT '',
                origin TEXT NOT NULL DEFAULT '',
                origin_country TEXT NOT NULL DEFAULT '',
                origin_region TEXT NOT NULL DEFAULT '',
                blend TEXT NOT NULL DEFAULT '',
                roast TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'active',
                dose REAL NOT NULL DEFAULT 18,
                yield_amount REAL NOT NULL DEFAULT 36,
                time_seconds INTEGER NOT NULL DEFAULT 28,
                grind TEXT NOT NULL DEFAULT '',
                temp REAL,
                rating REAL NOT NULL DEFAULT 0,
                order_url TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS beans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                roaster TEXT NOT NULL DEFAULT '',
                origin_country TEXT NOT NULL DEFAULT '',
                origin_region TEXT NOT NULL DEFAULT '',
                blend TEXT NOT NULL DEFAULT '',
                roast TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'active',
                order_url TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                flavor_notes_json TEXT NOT NULL DEFAULT '[]',
                favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS brew_recipes (
                id TEXT PRIMARY KEY,
                bean_id TEXT NOT NULL,
                name TEXT NOT NULL,
                method TEXT NOT NULL,
                values_json TEXT NOT NULL DEFAULT '{}',
                steps_json TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(bean_id) REFERENCES beans(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS dial_in_logs (
                id TEXT PRIMARY KEY,
                bean_id TEXT NOT NULL,
                brew_recipe_id TEXT NOT NULL,
                grind REAL NOT NULL,
                dose REAL,
                beverage_yield REAL,
                time_seconds REAL NOT NULL,
                taste TEXT NOT NULL DEFAULT 'neutral',
                rating REAL,
                valid INTEGER NOT NULL DEFAULT 1,
                notes TEXT NOT NULL DEFAULT '',
                brewed_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(bean_id) REFERENCES beans(id) ON DELETE CASCADE,
                FOREIGN KEY(brew_recipe_id) REFERENCES brew_recipes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_brew_recipes_bean_method
                ON brew_recipes(bean_id, method);
            CREATE INDEX IF NOT EXISTS idx_dial_in_logs_recipe_date
                ON dial_in_logs(brew_recipe_id, brewed_at DESC);
            """
        )
        _ensure_legacy_recipe_columns(db)
        _ensure_bean_columns(db)
        db.executemany(
            "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
            [("machine", DEFAULT_MACHINE), ("grinder", DEFAULT_GRINDER), ("theme", DEFAULT_THEME)],
        )
        _migrate_legacy_recipes(db)
        _seed_new_database(db)
