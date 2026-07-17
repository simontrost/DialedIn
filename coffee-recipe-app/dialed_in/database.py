from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from flask import current_app

from .scraping.coffee_detection import parse_legacy_origin
from .settings.service import DEFAULT_GRINDER, DEFAULT_MACHINE


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


def ensure_recipe_columns(db: sqlite3.Connection) -> None:
    existing = {
        row["name"]
        for row in db.execute("PRAGMA table_info(recipes)").fetchall()
    }
    additions = {
        "origin_country": "TEXT NOT NULL DEFAULT ''",
        "origin_region": "TEXT NOT NULL DEFAULT ''",
        "blend": "TEXT NOT NULL DEFAULT ''",
    }

    for name, definition in additions.items():
        if name not in existing:
            db.execute(f"ALTER TABLE recipes ADD COLUMN {name} {definition}")


def migrate_recipe_data(db: sqlite3.Connection) -> None:
    db.execute(
        """
        UPDATE recipes
        SET roast = CASE roast
            WHEN 'hell' THEN 'light'
            WHEN 'mittel' THEN 'medium'
            WHEN 'dunkel' THEN 'dark'
            ELSE roast
        END
        """
    )
    db.execute(
        """
        UPDATE recipes
        SET status = CASE status
            WHEN 'aktiv' THEN 'active'
            WHEN 'leer' THEN 'empty'
            WHEN 'wunschliste' THEN 'wishlist'
            ELSE status
        END
        """
    )

    rows = db.execute(
        """
        SELECT id, origin, origin_country, origin_region, blend
        FROM recipes
        """
    ).fetchall()

    for row in rows:
        if row["origin_country"] or row["origin_region"] or row["blend"]:
            continue

        country, region, blend = parse_legacy_origin(row["origin"])
        db.execute(
            """
            UPDATE recipes
            SET origin_country = ?, origin_region = ?, blend = ?
            WHERE id = ?
            """,
            (country, region, blend, row["id"]),
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
            """
        )

        ensure_recipe_columns(db)
        db.executemany(
            "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
            [
                ("machine", DEFAULT_MACHINE),
                ("grinder", DEFAULT_GRINDER),
            ],
        )
        migrate_recipe_data(db)

        existing = db.execute(
            "SELECT COUNT(*) AS amount FROM recipes"
        ).fetchone()["amount"]
        if existing == 0:
            seed_recipes(db)


def seed_recipes(db: sqlite3.Connection) -> None:
    # Local import prevents database initialization and recipe services
    # from importing each other while the package is loaded.
    from .recipes.service import create_recipe

    examples = [
        {
            "name": "House Blend 70/30",
            "roaster": "Example Roastery",
            "originCountry": "Multiple origins",
            "originRegion": "",
            "blend": "70% Arabica / 30% Robusta",
            "roast": "dark",
            "status": "active",
            "dose": 18,
            "yield": 38,
            "time": 28,
            "grind": "17.5",
            "temp": 93,
            "rating": 4.5,
            "notes": "Bold, chocolatey, and full of crema. A very reliable recipe.",
            "favorite": True,
        },
        {
            "name": "Classic Espresso",
            "roaster": "Example Roastery",
            "originCountry": "Multiple origins",
            "originRegion": "",
            "blend": "50% Arabica / 50% Robusta",
            "roast": "dark",
            "status": "active",
            "dose": 18,
            "yield": 36,
            "time": 27,
            "grind": "18",
            "temp": 92,
            "rating": 4,
            "notes": "Pull the shot slightly shorter if it becomes too bitter.",
            "favorite": False,
        },
        {
            "name": "Single Origin Arabica",
            "roaster": "Example Roastery",
            "originCountry": "Brazil",
            "originRegion": "Minas Gerais",
            "blend": "100% Arabica",
            "roast": "medium",
            "status": "wishlist",
            "dose": 18,
            "yield": 40,
            "time": 30,
            "grind": "16.5",
            "temp": 94,
            "rating": 3.5,
            "notes": "Test recipe: try a longer ratio and a slightly higher temperature.",
            "favorite": False,
        },
    ]

    for recipe in examples:
        create_recipe(db, recipe)
