from __future__ import annotations

import sqlite3
from typing import Any


def find_all(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM dial_in_logs ORDER BY brewed_at DESC, created_at DESC"
    ).fetchall()


def find_by_recipe(db: sqlite3.Connection, recipe_id: str) -> list[sqlite3.Row]:
    return db.execute(
        """
        SELECT * FROM dial_in_logs
        WHERE brew_recipe_id = ?
        ORDER BY brewed_at DESC, created_at DESC
        """,
        (recipe_id,),
    ).fetchall()


def find_by_id(db: sqlite3.Connection, log_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM dial_in_logs WHERE id = ?", (log_id,)).fetchone()


def row_to_log(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "beanId": row["bean_id"],
        "brewRecipeId": row["brew_recipe_id"],
        "grind": row["grind"],
        "dose": row["dose"],
        "beverageYield": row["beverage_yield"],
        "time": row["time_seconds"],
        "taste": row["taste"],
        "rating": row["rating"],
        "valid": bool(row["valid"]),
        "notes": row["notes"],
        "brewedAt": row["brewed_at"],
        "createdAt": row["created_at"],
    }


def insert(db: sqlite3.Connection, log: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT INTO dial_in_logs (
            id, bean_id, brew_recipe_id, grind, dose, beverage_yield,
            time_seconds, taste, rating, valid, notes, brewed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            log["id"], log["beanId"], log["brewRecipeId"], log["grind"],
            log["dose"], log["beverageYield"], log["time"], log["taste"],
            log["rating"], int(log["valid"]), log["notes"], log["brewedAt"],
            log["createdAt"],
        ),
    )


def update(db: sqlite3.Connection, log: dict[str, Any]) -> bool:
    result = db.execute(
        """
        UPDATE dial_in_logs SET
            bean_id = ?, brew_recipe_id = ?, grind = ?, dose = ?,
            beverage_yield = ?, time_seconds = ?, taste = ?, rating = ?,
            valid = ?, notes = ?, brewed_at = ?
        WHERE id = ?
        """,
        (
            log["beanId"], log["brewRecipeId"], log["grind"], log["dose"],
            log["beverageYield"], log["time"], log["taste"], log["rating"],
            int(log["valid"]), log["notes"], log["brewedAt"], log["id"],
        ),
    )
    return result.rowcount > 0


def delete_by_id(db: sqlite3.Connection, log_id: str) -> bool:
    result = db.execute("DELETE FROM dial_in_logs WHERE id = ?", (log_id,))
    return result.rowcount > 0
