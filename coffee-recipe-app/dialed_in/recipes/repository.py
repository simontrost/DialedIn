from __future__ import annotations

import sqlite3
from typing import Any

from .validation import read_grind_setting


def find_all(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute(
        """
        SELECT *
        FROM recipes
        ORDER BY favorite DESC, updated_at DESC
        """
    ).fetchall()


def find_by_id(
    db: sqlite3.Connection,
    recipe_id: str,
) -> sqlite3.Row | None:
    return db.execute(
        "SELECT * FROM recipes WHERE id = ?",
        (recipe_id,),
    ).fetchone()


def row_to_recipe(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "roaster": row["roaster"],
        "originCountry": row["origin_country"],
        "originRegion": row["origin_region"],
        "blend": row["blend"],
        "roast": row["roast"],
        "status": row["status"],
        "dose": row["dose"],
        "yield": row["yield_amount"],
        "time": row["time_seconds"],
        "grind": read_grind_setting(row["grind"]),
        "temp": row["temp"],
        "rating": row["rating"],
        "orderUrl": row["order_url"],
        "notes": row["notes"],
        "favorite": bool(row["favorite"]),
        "updatedAt": row["updated_at"],
    }


def insert(db: sqlite3.Connection, recipe: dict[str, Any]) -> None:
    db.execute(
        """
        INSERT INTO recipes (
            id, name, roaster, origin, origin_country, origin_region, blend,
            roast, status, dose, yield_amount, time_seconds, grind, temp,
            rating, order_url, notes, favorite, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            recipe["id"],
            recipe["name"],
            recipe["roaster"],
            recipe["origin"],
            recipe["originCountry"],
            recipe["originRegion"],
            recipe["blend"],
            recipe["roast"],
            recipe["status"],
            recipe["dose"],
            recipe["yield"],
            recipe["time"],
            recipe["grind"],
            recipe["temp"],
            recipe["rating"],
            recipe["orderUrl"],
            recipe["notes"],
            int(recipe["favorite"]),
            recipe["updatedAt"],
        ),
    )


def update(db: sqlite3.Connection, recipe: dict[str, Any]) -> None:
    db.execute(
        """
        UPDATE recipes SET
            name = ?,
            roaster = ?,
            origin = ?,
            origin_country = ?,
            origin_region = ?,
            blend = ?,
            roast = ?,
            status = ?,
            dose = ?,
            yield_amount = ?,
            time_seconds = ?,
            grind = ?,
            temp = ?,
            rating = ?,
            order_url = ?,
            notes = ?,
            favorite = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            recipe["name"],
            recipe["roaster"],
            recipe["origin"],
            recipe["originCountry"],
            recipe["originRegion"],
            recipe["blend"],
            recipe["roast"],
            recipe["status"],
            recipe["dose"],
            recipe["yield"],
            recipe["time"],
            recipe["grind"],
            recipe["temp"],
            recipe["rating"],
            recipe["orderUrl"],
            recipe["notes"],
            int(recipe["favorite"]),
            recipe["updatedAt"],
            recipe["id"],
        ),
    )


def delete_by_id(db: sqlite3.Connection, recipe_id: str) -> bool:
    result = db.execute(
        "DELETE FROM recipes WHERE id = ?",
        (recipe_id,),
    )
    return result.rowcount > 0


def delete_all(db: sqlite3.Connection) -> None:
    db.execute("DELETE FROM recipes")
