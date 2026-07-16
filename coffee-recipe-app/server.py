from __future__ import annotations

import json
import os
import sqlite3
import uuid
from io import BytesIO
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_file, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "data" / "coffee.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=None)
app.config["JSON_SORT_KEYS"] = False
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024

PUBLIC_ASSETS = {"styles.css", "app.js", "manifest.webmanifest", "icon.svg"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db_connection():
    connection = sqlite3.connect(DB_PATH)
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


def init_db() -> None:
    with db_connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                roaster TEXT NOT NULL DEFAULT '',
                origin TEXT NOT NULL DEFAULT '',
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

        db.executemany(
            "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
            [
                ("machine", "Gaggia Classic Evo Pro E24"),
                ("grinder", "Turin G-Micron DF64P"),
            ],
        )

        # Migrate data created by the original German-language version.
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

        existing = db.execute("SELECT COUNT(*) AS amount FROM recipes").fetchone()["amount"]
        if existing == 0:
            seed_recipes(db)


def seed_recipes(db: sqlite3.Connection) -> None:
    examples = [
        {
            "name": "House Blend 70/30",
            "roaster": "Example Roastery",
            "origin": "70 % Arabica · 30 % Robusta",
            "roast": "dark",
            "status": "active",
            "dose": 18,
            "yield": 38,
            "time": 28,
            "grind": "17,5",
            "temp": 93,
            "rating": 4.5,
            "notes": "Bold, chocolatey, and full of crema. A very reliable recipe.",
            "favorite": True,
        },
        {
            "name": "Classic Espresso",
            "roaster": "Example Roastery",
            "origin": "50 % Arabica · 50 % Robusta",
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
            "origin": "Brazil · 100% Arabica",
            "roast": "medium",
            "status": "wishlist",
            "dose": 18,
            "yield": 40,
            "time": 30,
            "grind": "16,5",
            "temp": 94,
            "rating": 3.5,
            "notes": "Test recipe: try a longer ratio and a slightly higher temperature.",
            "favorite": False,
        },
    ]
    for recipe in examples:
        insert_recipe(db, recipe)


def row_to_recipe(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "roaster": row["roaster"],
        "origin": row["origin"],
        "roast": row["roast"],
        "status": row["status"],
        "dose": row["dose"],
        "yield": row["yield_amount"],
        "time": row["time_seconds"],
        "grind": row["grind"],
        "temp": row["temp"],
        "rating": row["rating"],
        "orderUrl": row["order_url"],
        "notes": row["notes"],
        "favorite": bool(row["favorite"]),
        "updatedAt": row["updated_at"],
    }


def clean_recipe(payload: dict[str, Any], recipe_id: str | None = None) -> dict[str, Any]:
    name = str(payload.get("name", "")).strip()
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

    dose = float(payload.get("dose", 18))
    yield_amount = float(payload.get("yield", 36))
    time_seconds = int(float(payload.get("time", 28)))
    rating = float(payload.get("rating", 0) or 0)
    temp_value = payload.get("temp")
    temp = float(temp_value) if temp_value not in (None, "") else None

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
        "roaster": str(payload.get("roaster", "")).strip()[:60],
        "origin": str(payload.get("origin", "")).strip()[:80],
        "roast": roast,
        "status": status,
        "dose": dose,
        "yield": yield_amount,
        "time": time_seconds,
        "grind": str(payload.get("grind", "")).strip()[:20],
        "temp": temp,
        "rating": rating,
        "orderUrl": str(payload.get("orderUrl", "")).strip()[:500],
        "notes": str(payload.get("notes", "")).strip()[:500],
        "favorite": bool(payload.get("favorite", False)),
        "updatedAt": utc_now(),
    }


def insert_recipe(db: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    recipe = clean_recipe(payload)
    db.execute(
        """
        INSERT INTO recipes (
            id, name, roaster, origin, roast, status, dose, yield_amount,
            time_seconds, grind, temp, rating, order_url, notes, favorite, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            recipe["id"], recipe["name"], recipe["roaster"], recipe["origin"],
            recipe["roast"], recipe["status"], recipe["dose"], recipe["yield"],
            recipe["time"], recipe["grind"], recipe["temp"], recipe["rating"],
            recipe["orderUrl"], recipe["notes"], int(recipe["favorite"]), recipe["updatedAt"],
        ),
    )
    return recipe


def state_payload(db: sqlite3.Connection) -> dict[str, Any]:
    settings_rows = db.execute("SELECT key, value FROM settings").fetchall()
    recipes_rows = db.execute(
        "SELECT * FROM recipes ORDER BY favorite DESC, updated_at DESC"
    ).fetchall()
    return {
        "settings": {row["key"]: row["value"] for row in settings_rows},
        "recipes": [row_to_recipe(row) for row in recipes_rows],
    }


@app.get("/api/state")
def get_state():
    with db_connection() as db:
        return jsonify(state_payload(db))


@app.post("/api/recipes")
def create_recipe():
    try:
        with db_connection() as db:
            recipe = insert_recipe(db, request.get_json(force=True) or {})
        return jsonify(recipe), 201
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.put("/api/recipes/<recipe_id>")
def update_recipe(recipe_id: str):
    try:
        recipe = clean_recipe(request.get_json(force=True) or {}, recipe_id)
        with db_connection() as db:
            exists = db.execute("SELECT 1 FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
            if not exists:
                return jsonify({"error": "Recipe not found."}), 404

            db.execute(
                """
                UPDATE recipes SET
                    name = ?, roaster = ?, origin = ?, roast = ?, status = ?,
                    dose = ?, yield_amount = ?, time_seconds = ?, grind = ?,
                    temp = ?, rating = ?, order_url = ?, notes = ?, favorite = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    recipe["name"], recipe["roaster"], recipe["origin"], recipe["roast"],
                    recipe["status"], recipe["dose"], recipe["yield"], recipe["time"],
                    recipe["grind"], recipe["temp"], recipe["rating"], recipe["orderUrl"],
                    recipe["notes"], int(recipe["favorite"]), recipe["updatedAt"], recipe_id,
                ),
            )
        return jsonify(recipe)
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.delete("/api/recipes/<recipe_id>")
def delete_recipe(recipe_id: str):
    with db_connection() as db:
        result = db.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        if result.rowcount == 0:
            return jsonify({"error": "Recipe not found."}), 404
    return "", 204


@app.put("/api/settings")
def update_settings():
    payload = request.get_json(force=True) or {}
    machine = str(payload.get("machine", "")).strip()[:80] or "Gaggia Classic Evo Pro E24"
    grinder = str(payload.get("grinder", "")).strip()[:80] or "Turin G-Micron DF64P"

    with db_connection() as db:
        db.executemany(
            """
            INSERT INTO settings(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            [("machine", machine), ("grinder", grinder)],
        )
    return jsonify({"machine": machine, "grinder": grinder})


@app.get("/api/export")
def export_data():
    with db_connection() as db:
        payload = {
            "app": "Dialed In",
            "version": 1,
            "exportedAt": utc_now(),
            **state_payload(db),
        }

    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return send_file(
        BytesIO(content),
        as_attachment=True,
        download_name=f"dialed-in-backup-{datetime.now().date().isoformat()}.json",
        mimetype="application/json",
    )


@app.post("/api/import")
def import_data():
    payload = request.get_json(force=True) or {}
    recipes = payload.get("recipes")
    if not isinstance(recipes, list):
        return jsonify({"error": "Invalid backup file."}), 400

    try:
        cleaned = [clean_recipe(item) for item in recipes]
    except (ValueError, TypeError) as exc:
        return jsonify({"error": f"Import failed: {exc}"}), 400

    settings = payload.get("settings") or {}
    machine = str(settings.get("machine", "Gaggia Classic Evo Pro E24")).strip()[:80]
    grinder = str(settings.get("grinder", "Turin G-Micron DF64P")).strip()[:80]

    with db_connection() as db:
        db.execute("DELETE FROM recipes")
        for recipe in cleaned:
            insert_recipe(db, recipe)
        db.executemany(
            """
            INSERT INTO settings(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            [("machine", machine), ("grinder", grinder)],
        )
    return jsonify({"imported": len(cleaned)})


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:asset_path>")
def static_assets(asset_path: str):
    if asset_path not in PUBLIC_ASSETS:
        return jsonify({"error": "File not found."}), 404
    return send_from_directory(BASE_DIR, asset_path)


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), debug=False)
