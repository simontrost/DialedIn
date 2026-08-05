from __future__ import annotations

from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from ..database import init_db
from .service import (
    create_profile,
    get_profile_avatar,
    get_profiles_payload,
    initialize_legacy_password,
    login_profile,
    sign_out_profile,
    update_profile,
)

profiles_blueprint = Blueprint("profiles", __name__)


def _payload_value(name: str, default: str = "") -> str:
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        return str(payload.get(name, default) or default)
    return str(request.form.get(name, default) or default)


def _avatar_bytes() -> bytes | None:
    upload = request.files.get("avatar")
    if not upload or not upload.filename:
        return None
    maximum = 1024 * 1024
    data = upload.stream.read(maximum + 1)
    return data


@profiles_blueprint.get("/api/profiles")
def list_profiles():
    return jsonify(get_profiles_payload())


@profiles_blueprint.post("/api/profiles")
def add_profile():
    password = _payload_value("password")
    confirmation = _payload_value("passwordConfirmation")
    if password != confirmation:
        return jsonify({"error": "The password confirmation does not match."}), 400

    try:
        profile, database_path = create_profile(
            _payload_value("name"),
            password,
            _avatar_bytes(),
        )
        init_db(database_path, seed=False)
        return jsonify(profile), 201
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400


@profiles_blueprint.post("/api/profiles/<profile_id>/login")
def login(profile_id: str):
    try:
        return jsonify(login_profile(profile_id, _payload_value("password")))
    except PermissionError as error:
        return jsonify({"error": str(error)}), 401
    except RuntimeError as error:
        return jsonify({"error": str(error), "code": "password_setup_required"}), 409
    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@profiles_blueprint.post("/api/profiles/<profile_id>/setup-password")
def setup_password(profile_id: str):
    password = _payload_value("password")
    confirmation = _payload_value("passwordConfirmation")
    if password != confirmation:
        return jsonify({"error": "The password confirmation does not match."}), 400
    try:
        return jsonify(initialize_legacy_password(profile_id, password))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@profiles_blueprint.patch("/api/profiles/<profile_id>")
def edit_profile(profile_id: str):
    new_password = _payload_value("newPassword")
    confirmation = _payload_value("newPasswordConfirmation")
    if new_password != confirmation:
        return jsonify({"error": "The new password confirmation does not match."}), 400

    try:
        return jsonify(
            update_profile(
                profile_id,
                name=_payload_value("name"),
                current_password=_payload_value("currentPassword"),
                new_password=new_password,
                avatar_data=_avatar_bytes(),
                remove_avatar=_payload_value("removeAvatar").lower() in {"1", "true", "yes", "on"},
            )
        )
    except PermissionError as error:
        return jsonify({"error": str(error)}), 403
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@profiles_blueprint.get("/api/profiles/<profile_id>/avatar")
def profile_avatar(profile_id: str):
    avatar = get_profile_avatar(profile_id)
    if avatar is None:
        return "", 404
    mime, data = avatar
    response = send_file(
        BytesIO(data),
        mimetype=mime,
        max_age=86400,
        conditional=True,
        download_name=f"profile-{profile_id}",
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@profiles_blueprint.post("/api/profiles/logout")
def logout_profile():
    sign_out_profile()
    return "", 204
