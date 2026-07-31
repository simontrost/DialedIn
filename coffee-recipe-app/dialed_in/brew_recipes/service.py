from __future__ import annotations

import sqlite3
import uuid
from typing import Any

from ..beans.repository import find_by_id as find_bean_by_id
from ..database import utc_now
from . import repository
from .validation import validate_brew_recipe


def _prepare_for_bean(db: sqlite3.Connection, clean: dict[str, Any]) -> dict[str, Any]:
    bean = find_bean_by_id(db, clean["beanId"])
    if not bean:
        raise ValueError("Selected bean does not exist.")
    if bool(bean["is_ground"]):
        clean["values"].pop("grind", None)
    return clean


def list_brew_recipes(db: sqlite3.Connection) -> list[dict[str, Any]]:
    return [repository.row_to_recipe(row) for row in repository.find_all(db)]


def get_brew_recipe(db: sqlite3.Connection, recipe_id: str) -> dict[str, Any] | None:
    row = repository.find_by_id(db, recipe_id)
    return repository.row_to_recipe(row) if row else None


def create_brew_recipe(db: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    clean = _prepare_for_bean(db, validate_brew_recipe(payload))
    timestamp = utc_now()
    recipe = {
        "id": str(uuid.uuid4()),
        **clean,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    repository.insert(db, recipe)
    return recipe


def update_brew_recipe(
    db: sqlite3.Connection,
    recipe_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    current = get_brew_recipe(db, recipe_id)
    if not current:
        return None
    clean = _prepare_for_bean(db, validate_brew_recipe(payload))
    recipe = {
        **current,
        **clean,
        "id": recipe_id,
        "updatedAt": utc_now(),
    }
    repository.update(db, recipe)
    return recipe


def delete_brew_recipe(db: sqlite3.Connection, recipe_id: str) -> bool:
    return repository.delete_by_id(db, recipe_id)
