from flask import Blueprint, jsonify, request

from ..database import db_connection
from .service import save_settings, validate_settings

settings_blueprint = Blueprint("settings", __name__)


@settings_blueprint.put("/api/settings")
def update_settings():
    payload = request.get_json(force=True) or {}
    try:
        settings = validate_settings(payload)
        with db_connection() as db:
            save_settings(db, settings)
        return jsonify(settings)
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400
