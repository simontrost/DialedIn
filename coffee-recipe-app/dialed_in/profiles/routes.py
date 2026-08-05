from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import init_db
from .service import (
    activate_profile,
    create_profile,
    get_profiles_payload,
    sign_out_profile,
)

profiles_blueprint = Blueprint("profiles", __name__)


@profiles_blueprint.get("/api/profiles")
def list_profiles():
    return jsonify(get_profiles_payload())


@profiles_blueprint.post("/api/profiles")
def add_profile():
    payload = request.get_json(silent=True) or {}
    try:
        profile, database_path = create_profile(payload.get("name", ""))
        init_db(database_path, seed=False)
        return jsonify(profile), 201
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400


@profiles_blueprint.post("/api/profiles/<profile_id>/activate")
def select_profile(profile_id: str):
    try:
        return jsonify(activate_profile(profile_id))
    except ValueError as error:
        return jsonify({"error": str(error)}), 404


@profiles_blueprint.post("/api/profiles/logout")
def logout_profile():
    sign_out_profile()
    return "", 204
