from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import current_app, has_request_context, session
from werkzeug.security import check_password_hash, generate_password_hash

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


def _profile_columns(db: sqlite3.Connection) -> set[str]:
    return {row["name"] for row in db.execute("PRAGMA table_info(profiles)").fetchall()}


def _ensure_profile_columns(db: sqlite3.Connection) -> None:
    additions = {
        "password_hash": "TEXT",
        "avatar_mime": "TEXT",
        "avatar_data": "BLOB",
        "updated_at": "TEXT",
    }
    existing = _profile_columns(db)
    for name, definition in additions.items():
        if name not in existing:
            db.execute(f"ALTER TABLE profiles ADD COLUMN {name} {definition}")

    timestamp = _utc_now()
    db.execute(
        """
        UPDATE profiles
        SET updated_at = COALESCE(updated_at, last_used_at, created_at, ?)
        WHERE updated_at IS NULL OR TRIM(updated_at) = ''
        """,
        (timestamp,),
    )


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
                last_used_at TEXT NOT NULL,
                password_hash TEXT,
                avatar_mime TEXT,
                avatar_data BLOB,
                updated_at TEXT NOT NULL
            )
            """
        )
        _ensure_profile_columns(db)
        count = db.execute("SELECT COUNT(*) AS count FROM profiles").fetchone()["count"]
        if count == 0:
            timestamp = _utc_now()
            db.execute(
                """
                INSERT INTO profiles (
                    id, name, database_path, is_default, created_at, last_used_at,
                    password_hash, avatar_mime, avatar_data, updated_at
                ) VALUES ('default', ?, ?, 1, ?, ?, NULL, NULL, NULL, ?)
                """,
                (
                    str(current_app.config.get("DEFAULT_PROFILE_NAME") or "Main profile"),
                    _serialize_database_path(Path(current_app.config["DB_PATH"])),
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )
        db.commit()


def _select_fields() -> str:
    return """
        id, name, database_path, is_default, created_at, last_used_at,
        password_hash, avatar_mime, avatar_data, updated_at
    """


def _row_to_internal(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "databasePath": _resolve_database_path(row["database_path"]),
        "isDefault": bool(row["is_default"]),
        "createdAt": row["created_at"],
        "lastUsedAt": row["last_used_at"],
        "updatedAt": row["updated_at"],
    }


def _row_to_public(row: sqlite3.Row, active_profile_id: str | None) -> dict[str, Any]:
    has_avatar = bool(row["avatar_data"] and row["avatar_mime"])
    avatar_url = None
    if has_avatar:
        avatar_url = f"/api/profiles/{row['id']}/avatar?v={row['updated_at']}"
    return {
        "id": row["id"],
        "name": row["name"],
        "isDefault": bool(row["is_default"]),
        "isActive": row["id"] == active_profile_id,
        "needsPasswordSetup": not bool(row["password_hash"]),
        "hasAvatar": has_avatar,
        "avatarUrl": avatar_url,
        "createdAt": row["created_at"],
        "lastUsedAt": row["last_used_at"],
        "updatedAt": row["updated_at"],
    }


def list_profile_records() -> list[dict[str, Any]]:
    with _registry_connection() as db:
        rows = db.execute(
            f"""
            SELECT {_select_fields()}
            FROM profiles
            ORDER BY is_default DESC, LOWER(name), created_at
            """
        ).fetchall()
    return [_row_to_internal(row) for row in rows]


def _find_row(profile_id: str) -> sqlite3.Row | None:
    with _registry_connection() as db:
        return db.execute(
            f"SELECT {_select_fields()} FROM profiles WHERE id = ?",
            (profile_id,),
        ).fetchone()


def _default_row() -> sqlite3.Row:
    with _registry_connection() as db:
        row = db.execute(
            f"""
            SELECT {_select_fields()}
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

    return None


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
            f"""
            SELECT {_select_fields()}
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
        raise ProfileRequiredError("Log in to a profile to access your coffee data.")
    row = _find_row(profile_id)
    if row is None:
        raise ProfileRequiredError("The active profile no longer exists.")
    return _resolve_database_path(row["database_path"])


def _validate_name(name: str) -> str:
    clean_name = " ".join(str(name or "").split())
    if not clean_name:
        raise ValueError("Enter a profile name.")
    if len(clean_name) > 40:
        raise ValueError("Profile names can contain at most 40 characters.")
    return clean_name


def _validate_password(password: str) -> str:
    password = str(password or "")
    if len(password) < 6:
        raise ValueError("The password must contain at least 6 characters.")
    if len(password) > 128:
        raise ValueError("The password can contain at most 128 characters.")
    return password


def validate_avatar(data: bytes | None) -> tuple[str | None, bytes | None]:
    if not data:
        return None, None

    maximum = int(current_app.config.get("PROFILE_IMAGE_MAX_BYTES", 1024 * 1024))
    if len(data) > maximum:
        raise ValueError("The profile image can be at most 1 MB.")

    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise ValueError("Use a PNG, JPEG or WebP image.")
    return mime, data


def create_profile(
    name: str,
    password: str,
    avatar_data: bytes | None = None,
) -> tuple[dict[str, Any], Path]:
    clean_name = _validate_name(name)
    clean_password = _validate_password(password)
    avatar_mime, avatar_blob = validate_avatar(avatar_data)

    profile_id = str(uuid.uuid4())
    database_path = (_profile_database_dir() / f"{profile_id}.db").resolve()
    timestamp = _utc_now()

    try:
        with _registry_connection() as db:
            db.execute(
                """
                INSERT INTO profiles (
                    id, name, database_path, is_default, created_at, last_used_at,
                    password_hash, avatar_mime, avatar_data, updated_at
                ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    clean_name,
                    _serialize_database_path(database_path),
                    timestamp,
                    timestamp,
                    generate_password_hash(clean_password),
                    avatar_mime,
                    avatar_blob,
                    timestamp,
                ),
            )
            db.commit()
    except sqlite3.IntegrityError as error:
        raise ValueError("A profile with this name already exists.") from error

    session[_ACTIVE_PROFILE_KEY] = profile_id
    session.pop(_SIGNED_OUT_KEY, None)
    row = _find_row(profile_id)
    assert row is not None
    return _row_to_public(row, profile_id), database_path


def login_profile(profile_id: str, password: str) -> dict[str, Any]:
    row = _find_row(profile_id)
    if row is None:
        raise ValueError("The selected profile does not exist.")
    if not row["password_hash"]:
        raise RuntimeError("This profile needs a password before it can be used.")
    if not check_password_hash(row["password_hash"], str(password or "")):
        raise PermissionError("Incorrect password.")

    return _activate_authenticated_profile(profile_id)


def initialize_legacy_password(profile_id: str, password: str) -> dict[str, Any]:
    clean_password = _validate_password(password)
    row = _find_row(profile_id)
    if row is None:
        raise ValueError("The selected profile does not exist.")
    if row["password_hash"]:
        raise ValueError("This profile already has a password.")

    timestamp = _utc_now()
    with _registry_connection() as db:
        db.execute(
            """
            UPDATE profiles
            SET password_hash = ?, last_used_at = ?, updated_at = ?
            WHERE id = ? AND password_hash IS NULL
            """,
            (generate_password_hash(clean_password), timestamp, timestamp, profile_id),
        )
        db.commit()
    return _activate_authenticated_profile(profile_id)


def _activate_authenticated_profile(profile_id: str) -> dict[str, Any]:
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


def update_profile(
    profile_id: str,
    *,
    name: str,
    current_password: str = "",
    new_password: str = "",
    avatar_data: bytes | None = None,
    remove_avatar: bool = False,
) -> dict[str, Any]:
    active_profile_id = get_active_profile_id()
    if active_profile_id != profile_id:
        raise PermissionError("Only the active profile can be edited.")

    row = _find_row(profile_id)
    if row is None:
        raise ValueError("The selected profile does not exist.")

    clean_name = _validate_name(name)
    password_hash = row["password_hash"]
    if new_password:
        clean_new_password = _validate_password(new_password)
        if password_hash and not check_password_hash(password_hash, str(current_password or "")):
            raise PermissionError("The current password is incorrect.")
        password_hash = generate_password_hash(clean_new_password)
    elif not password_hash:
        raise ValueError("Set a password before continuing.")

    avatar_mime = row["avatar_mime"]
    avatar_blob = row["avatar_data"]
    if remove_avatar:
        avatar_mime = None
        avatar_blob = None
    if avatar_data:
        avatar_mime, avatar_blob = validate_avatar(avatar_data)

    timestamp = _utc_now()
    try:
        with _registry_connection() as db:
            db.execute(
                """
                UPDATE profiles
                SET name = ?, password_hash = ?, avatar_mime = ?, avatar_data = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    clean_name,
                    password_hash,
                    avatar_mime,
                    avatar_blob,
                    timestamp,
                    profile_id,
                ),
            )
            db.commit()
    except sqlite3.IntegrityError as error:
        raise ValueError("A profile with this name already exists.") from error

    refreshed = _find_row(profile_id)
    assert refreshed is not None
    return _row_to_public(refreshed, profile_id)


def get_profile_avatar(profile_id: str) -> tuple[str, bytes] | None:
    row = _find_row(profile_id)
    if row is None or not row["avatar_mime"] or not row["avatar_data"]:
        return None
    return str(row["avatar_mime"]), bytes(row["avatar_data"])


def sign_out_profile() -> None:
    session.pop(_ACTIVE_PROFILE_KEY, None)
    session[_SIGNED_OUT_KEY] = True
