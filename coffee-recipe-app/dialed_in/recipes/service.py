from __future__ import annotations

import sqlite3
from typing import Any

from . import repository
from .validation import validate_recipe_payload


def list_recipes(db: sqlite3.Connection) -> list[dict[str, Any]]:
    return [repository.row_to_recipe(row) for row in repository.find_all(db)]


def create_recipe(
    db: sqlite3.Connection,
    payload: dict[str, Any],
) -> dict[str, Any]:
    recipe = validate_recipe_payload(payload)
    repository.insert(db, recipe)
    return recipe


def update_recipe(
    db: sqlite3.Connection,
    recipe_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    if repository.find_by_id(db, recipe_id) is None:
        return None

    recipe = validate_recipe_payload(payload, recipe_id)
    repository.update(db, recipe)
    return recipe


def delete_recipe(db: sqlite3.Connection, recipe_id: str) -> bool:
    return repository.delete_by_id(db, recipe_id)
