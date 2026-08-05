from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

from dialed_in import create_app


LEGACY_TIMESTAMP = "2026-01-01T10:00:00+00:00"


def create_legacy_database(db_path: Path) -> None:
    """Create a bean table from before the latest bean fields existed."""

    with closing(sqlite3.connect(db_path)) as db:
        db.execute(
            """
            CREATE TABLE beans (
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
                favorite INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            INSERT INTO beans (
                id, name, roaster, roast, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "legacy-bean",
                "Old Espresso",
                "Old Roastery",
                "dark",
                "active",
                LEGACY_TIMESTAMP,
                LEGACY_TIMESTAMP,
            ),
        )
        db.commit()


def test_schema_upgrade_preserves_existing_bean(tmp_path: Path) -> None:
    db_path = tmp_path / "legacy.db"
    create_legacy_database(db_path)

    create_app({"TESTING": True, "DB_PATH": db_path})

    with closing(sqlite3.connect(db_path)) as db:
        columns = {
            row[1]
            for row in db.execute("PRAGMA table_info(beans)").fetchall()
        }
        bean = db.execute(
            """
            SELECT name, roaster, origin_altitude, sca_score, is_ground,
                   bag_size_grams, remaining_grams
            FROM beans
            WHERE id = ?
            """,
            ("legacy-bean",),
        ).fetchone()

    assert {
        "origin_altitude",
        "sca_score",
        "flavor_notes_json",
        "strength",
        "taste_balance",
        "decaf",
        "is_ground",
        "bag_size_grams",
        "remaining_grams",
    }.issubset(columns)
    assert bean == ("Old Espresso", "Old Roastery", "", None, 0, None, None)


def test_schema_upgrade_can_run_more_than_once(tmp_path: Path) -> None:
    db_path = tmp_path / "legacy.db"
    create_legacy_database(db_path)
    config = {"TESTING": True, "DB_PATH": db_path}

    create_app(config)
    create_app(config)

    with closing(sqlite3.connect(db_path)) as db:
        count = db.execute(
            "SELECT COUNT(*) FROM beans WHERE id = ?",
            ("legacy-bean",),
        ).fetchone()[0]

    assert count == 1
