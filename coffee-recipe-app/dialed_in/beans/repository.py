from __future__ import annotations

import json
import sqlite3
from typing import Any


def find_all(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM beans ORDER BY favorite DESC, updated_at DESC"
    ).fetchall()


def find_by_id(db: sqlite3.Connection, bean_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM beans WHERE id = ?", (bean_id,)).fetchone()


def _flavor_notes_from_row(row: sqlite3.Row) -> list[str]:
    try:
        value = json.loads(row["flavor_notes_json"] or "[]")
    except (json.JSONDecodeError, TypeError):
        return []
    return [str(item) for item in value if isinstance(item, str)] if isinstance(value, list) else []


def row_to_bean(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "roaster": row["roaster"],
        "originCountry": row["origin_country"],
        "originRegion": row["origin_region"],
        "originLatitude": row["origin_latitude"],
        "blend": row["blend"],
        "roast": row["roast"],
        "status": row["status"],
        "orderUrl": row["order_url"],
        "notes": row["notes"],
        "flavorNotes": _flavor_notes_from_row(row),
        "strength": float(row["strength"] or 0),
        "tasteBalance": row["taste_balance"],
        "decaf": bool(row["decaf"]),
        "favorite": bool(row["favorite"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def insert(db: sqlite3.Connection, bean: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT INTO beans (
            id, name, roaster, origin_country, origin_region, origin_latitude,
            blend, roast, status, order_url, notes, flavor_notes_json, strength,
            taste_balance, decaf, favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            bean["id"], bean["name"], bean["roaster"], bean["originCountry"],
            bean["originRegion"], bean["originLatitude"], bean["blend"],
            bean["roast"], bean["status"],
            bean["orderUrl"], bean["notes"],
            json.dumps(bean["flavorNotes"], ensure_ascii=False),
            bean["strength"], bean["tasteBalance"], int(bean["decaf"]),
            int(bean["favorite"]), bean["createdAt"], bean["updatedAt"],
        ),
    )


def update(db: sqlite3.Connection, bean: dict[str, Any]) -> None:
    db.execute(
        """
        UPDATE beans SET
            name = ?, roaster = ?, origin_country = ?, origin_region = ?,
            origin_latitude = ?, blend = ?, roast = ?, status = ?, order_url = ?, notes = ?,
            flavor_notes_json = ?, strength = ?, taste_balance = ?, decaf = ?,
            favorite = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            bean["name"], bean["roaster"], bean["originCountry"],
            bean["originRegion"], bean["originLatitude"], bean["blend"],
            bean["roast"], bean["status"],
            bean["orderUrl"], bean["notes"],
            json.dumps(bean["flavorNotes"], ensure_ascii=False),
            bean["strength"], bean["tasteBalance"], int(bean["decaf"]),
            int(bean["favorite"]), bean["updatedAt"], bean["id"],
        ),
    )


def delete_by_id(db: sqlite3.Connection, bean_id: str) -> bool:
    result = db.execute("DELETE FROM beans WHERE id = ?", (bean_id,))
    return result.rowcount > 0
