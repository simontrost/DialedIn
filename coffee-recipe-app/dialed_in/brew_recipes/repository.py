from __future__ import annotations

import json
import sqlite3
from typing import Any


def find_all(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM brew_recipes ORDER BY favorite DESC, updated_at DESC"
    ).fetchall()


def find_by_id(db: sqlite3.Connection, recipe_id: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM brew_recipes WHERE id = ?",
        (recipe_id,),
    ).fetchone()


def find_by_bean(db: sqlite3.Connection, bean_id: str) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM brew_recipes WHERE bean_id = ? ORDER BY updated_at DESC",
        (bean_id,),
    ).fetchall()


def clear_grind_for_bean(db: sqlite3.Connection, bean_id: str, updated_at: str) -> None:
    rows = find_by_bean(db, bean_id)
    for row in rows:
        try:
            values = json.loads(row["values_json"] or "{}")
        except (json.JSONDecodeError, TypeError):
            values = {}
        if not isinstance(values, dict) or "grind" not in values:
            continue
        values.pop("grind", None)
        db.execute(
            "UPDATE brew_recipes SET values_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(values, ensure_ascii=False), updated_at, row["id"]),
        )


def row_to_recipe(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "beanId": row["bean_id"],
        "name": row["name"],
        "method": row["method"],
        "values": json.loads(row["values_json"] or "{}"),
        "steps": json.loads(row["steps_json"] or "[]"),
        "notes": row["notes"],
        "favorite": bool(row["favorite"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def insert(db: sqlite3.Connection, recipe: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT INTO brew_recipes (
            id, bean_id, name, method, values_json, steps_json, notes,
            favorite, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            recipe["id"], recipe["beanId"], recipe["name"], recipe["method"],
            json.dumps(recipe["values"], ensure_ascii=False),
            json.dumps(recipe["steps"], ensure_ascii=False),
            recipe["notes"], int(recipe["favorite"]), recipe["createdAt"],
            recipe["updatedAt"],
        ),
    )


def update(db: sqlite3.Connection, recipe: dict[str, Any]) -> None:
    db.execute(
        """
        UPDATE brew_recipes SET
            bean_id = ?, name = ?, method = ?, values_json = ?, steps_json = ?,
            notes = ?, favorite = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            recipe["beanId"], recipe["name"], recipe["method"],
            json.dumps(recipe["values"], ensure_ascii=False),
            json.dumps(recipe["steps"], ensure_ascii=False),
            recipe["notes"], int(recipe["favorite"]), recipe["updatedAt"],
            recipe["id"],
        ),
    )


def delete_by_id(db: sqlite3.Connection, recipe_id: str) -> bool:
    result = db.execute("DELETE FROM brew_recipes WHERE id = ?", (recipe_id,))
    return result.rowcount > 0
