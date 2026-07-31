from __future__ import annotations

import sqlite3
import uuid
from typing import Any

from ..database import utc_now
from ..brew_recipes.repository import clear_grind_for_bean
from . import repository
from .validation import validate_bean


def list_beans(db: sqlite3.Connection) -> list[dict[str, Any]]:
    return [repository.row_to_bean(row) for row in repository.find_all(db)]


def get_bean(db: sqlite3.Connection, bean_id: str) -> dict[str, Any] | None:
    row = repository.find_by_id(db, bean_id)
    return repository.row_to_bean(row) if row else None


def create_bean(db: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    clean = validate_bean(payload)
    timestamp = utc_now()
    bean = {
        "id": str(uuid.uuid4()),
        **clean,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    repository.insert(db, bean)
    return bean


def update_bean(
    db: sqlite3.Connection,
    bean_id: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    current = get_bean(db, bean_id)
    if not current:
        return None
    clean = validate_bean(payload)
    bean = {
        **current,
        **clean,
        "id": bean_id,
        "updatedAt": utc_now(),
    }
    repository.update(db, bean)
    if bean["isGround"]:
        clear_grind_for_bean(db, bean_id, bean["updatedAt"])
    return bean


def delete_bean(db: sqlite3.Connection, bean_id: str) -> bool:
    return repository.delete_by_id(db, bean_id)
