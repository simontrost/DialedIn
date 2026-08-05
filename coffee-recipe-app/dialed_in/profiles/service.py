from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import current_app, has_request_context, session

_ACTIVE_PROFILE_KEY = "dialed_in_active_profile_id"
_SIGNED_OUT_KEY = "dialed_in_profile_signed_out"


class ProfileRequiredError(RuntimeError):
    """Raised when profile-scoped data is requested without an active profile."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _registry_path() -> Path:
    path = Path(current_app.config["PROFILE_REGISTRY_PATH"])
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _profile_database_dir() -> Path:
    path = Path(current_app.config["PROFILE_DATABASE_DIR"])
    path.mkdir(parents=True, exist_ok=True)
    return path


def _serialize_database_path(path: Path) -> str:
    resolved = path.resolve()
    registry_parent = _registry_path().parent.resolve()
    try:
        return str(resolved.relative_to(registry_parent))
    except ValueError:
        return str(resolved)


def _resolve_database_path(value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = _registry_path().parent / path
    return path.resolve()


def _registry_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(_registry_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def init_profile_store() -> None:
    """Create the global profile registry and adopt the existing coffee.db."""

    with _registry_connection() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                database_path TEXT NOT NULL UNIQUE,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                last_used_at TEXT NOT NULL
            )
            """
        )
        count = db.execute("SELECT COUNT(*) AS count FROM profiles").fetchone()["count"]
        if count == 0:
            timestamp = _utc_now()
            db.execute(
                """
                INSERT INTO profiles (
                    id, name, database_path, is_default, created_at, last_used_at
                ) VALUES ('default', ?, ?, 1, ?, ?)
                """,
                (
                    str(current_app.config.get("DEFAULT_PROFILE_NAME") or "Main profile"),
                    _serialize_database_path(Path(current_app.config["DB_PATH"])),
                    timestamp,
                    timestamp,
                ),
            )
        db.commit()


def _row_to_internal(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "databasePath": _resolve_database_path(row["database_path"]),
        "isDefault": bool(row["is_default"]),
        "createdAt": row["created_at"],
        "lastUsedAt": row["last_used_at"],
    }


def _row_to_public(row: sqlite3.Row, active_profile_id: str | None) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "isDefault": bool(row["is_default"]),
        "isActive": row["id"] == active_profile_id,
        "createdAt": row["created_at"],
        "lastUsedAt": row["last_used_at"],
    }


def list_profile_records() -> list[dict[str, Any]]:
    with _registry_connection() as db:
        rows = db.execute(
            """
            SELECT id, name, database_path, is_default, created_at, last_used_at
            FROM profiles
            ORDER BY is_default DESC, LOWER(name), created_at
            """
        ).fetchall()
    return [_row_to_internal(row) for row in rows]


def _find_row(profile_id: str) -> sqlite3.Row | None:
    with _registry_connection() as db:
        return db.execute(
            """
            SELECT id, name, database_path, is_default, created_at, last_used_at
            FROM profiles WHERE id = ?
            """,
            (profile_id,),
        ).fetchone()


def _default_row() -> sqlite3.Row:
    with _registry_connection() as db:
        row = db.execute(
            """
            SELECT id, name, database_path, is_default, created_at, last_used_at
            FROM profiles
            ORDER BY is_default DESC, created_at ASC
            LIMIT 1
            """
        ).fetchone()
    if row is None:
        raise RuntimeError("No Dialed In profile is configured.")
    return row


def get_active_profile_id() -> str | None:
    if not has_request_context():
        return _default_row()["id"]

    if session.get(_SIGNED_OUT_KEY):
        return None

    profile_id = session.get(_ACTIVE_PROFILE_KEY)
    if profile_id and _find_row(str(profile_id)) is not None:
        return str(profile_id)

    default_id = _default_row()["id"]
    session[_ACTIVE_PROFILE_KEY] = default_id
    return default_id


def get_active_profile() -> dict[str, Any] | None:
    profile_id = get_active_profile_id()
    if not profile_id:
        return None
    row = _find_row(profile_id)
    if row is None:
        return None
    return _row_to_public(row, profile_id)


def get_profiles_payload() -> dict[str, Any]:
    active_profile_id = get_active_profile_id()
    with _registry_connection() as db:
        rows = db.execute(
            """
            SELECT id, name, database_path, is_default, created_at, last_used_at
            FROM profiles
            ORDER BY is_default DESC, LOWER(name), created_at
            """
        ).fetchall()
    profiles = [_row_to_public(row, active_profile_id) for row in rows]
    active = next((profile for profile in profiles if profile["isActive"]), None)
    return {"profiles": profiles, "activeProfile": active}


def get_active_profile_db_path() -> Path:
    profile_id = get_active_profile_id()
    if not profile_id:
        raise ProfileRequiredError("Select a profile to access your coffee data.")
    row = _find_row(profile_id)
    if row is None:
        raise ProfileRequiredError("The active profile no longer exists.")
    return _resolve_database_path(row["database_path"])


def activate_profile(profile_id: str) -> dict[str, Any]:
    row = _find_row(profile_id)
    if row is None:
        raise ValueError("The selected profile does not exist.")

    timestamp = _utc_now()
    with _registry_connection() as db:
        db.execute(
            "UPDATE profiles SET last_used_at = ? WHERE id = ?",
            (timestamp, profile_id),
        )
        db.commit()

    session[_ACTIVE_PROFILE_KEY] = profile_id
    session.pop(_SIGNED_OUT_KEY, None)
    refreshed = _find_row(profile_id)
    assert refreshed is not None
    return _row_to_public(refreshed, profile_id)


def sign_out_profile() -> None:
    session.pop(_ACTIVE_PROFILE_KEY, None)
    session[_SIGNED_OUT_KEY] = True


def create_profile(name: str) -> tuple[dict[str, Any], Path]:
    clean_name = " ".join(str(name or "").split())
    if not clean_name:
        raise ValueError("Enter a profile name.")
    if len(clean_name) > 40:
        raise ValueError("Profile names can contain at most 40 characters.")

    profile_id = str(uuid.uuid4())
    database_path = (_profile_database_dir() / f"{profile_id}.db").resolve()
    timestamp = _utc_now()

    try:
        with _registry_connection() as db:
            db.execute(
                """
                INSERT INTO profiles (
                    id, name, database_path, is_default, created_at, last_used_at
                ) VALUES (?, ?, ?, 0, ?, ?)
                """,
                (profile_id, clean_name, _serialize_database_path(database_path), timestamp, timestamp),
            )
            db.commit()
    except sqlite3.IntegrityError as error:
        raise ValueError("A profile with this name already exists.") from error

    session[_ACTIVE_PROFILE_KEY] = profile_id
    session.pop(_SIGNED_OUT_KEY, None)
    row = _find_row(profile_id)
    assert row is not None
    return _row_to_public(row, profile_id), database_path
