from __future__ import annotations

import sqlite3
import uuid
from typing import Any

from ..beans.repository import find_by_id as find_bean_by_id
from ..brew_recipes.repository import find_by_id as find_recipe_by_id
from ..brew_recipes.repository import row_to_recipe
from ..database import utc_now
from . import repository
from .recommendation import calculate_recommendation
from .validation import validate_log


def list_logs(db: sqlite3.Connection) -> list[dict[str, Any]]:
    return [repository.row_to_log(row) for row in repository.find_all(db)]


def list_logs_for_recipe(db: sqlite3.Connection, recipe_id: str) -> list[dict[str, Any]]:
    return [repository.row_to_log(row) for row in repository.find_by_recipe(db, recipe_id)]


def _validate_relations(db: sqlite3.Connection, clean: dict[str, Any]) -> None:
    bean = find_bean_by_id(db, clean["beanId"])
    recipe_row = find_recipe_by_id(db, clean["brewRecipeId"])
    if not bean or not recipe_row:
        raise ValueError("Selected bean or recipe does not exist.")
    recipe = row_to_recipe(recipe_row)
    if recipe["beanId"] != clean["beanId"]:
        raise ValueError("The selected recipe does not belong to this bean.")


def create_log(db: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    clean = validate_log(payload)
    _validate_relations(db, clean)
    timestamp = utc_now()
    log = {
        "id": str(uuid.uuid4()),
        **clean,
        "createdAt": timestamp,
    }
    repository.insert(db, log)
    return log


def update_log(
    db: sqlite3.Connection,
    log_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    existing = repository.find_by_id(db, log_id)
    if not existing:
        return None

    clean = validate_log(payload)
    _validate_relations(db, clean)
    log = {
        "id": log_id,
        **clean,
        "createdAt": existing["created_at"],
    }
    repository.update(db, log)
    return log


def delete_log(db: sqlite3.Connection, log_id: str) -> bool:
    return repository.delete_by_id(db, log_id)


def recommend(db: sqlite3.Connection, recipe_id: str, max_step: float = 2.5) -> dict[str, Any]:
    recipe_row = find_recipe_by_id(db, recipe_id)
    if not recipe_row:
        raise ValueError("Recipe not found.")
    recipe = row_to_recipe(recipe_row)
    logs = list_logs_for_recipe(db, recipe_id)
    result = calculate_recommendation(logs, recipe["values"], max_step=max_step)
    return {**result, "recipeId": recipe_id, "beanId": recipe["beanId"], "method": recipe["method"]}
