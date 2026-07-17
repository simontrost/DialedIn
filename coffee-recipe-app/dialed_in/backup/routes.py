from __future__ import annotations

import json
from datetime import datetime
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from ..database import db_connection
from ..recipes import repository as recipe_repository
from ..recipes.service import list_recipes
from ..recipes.validation import validate_recipe_payload
from ..settings.service import (
    get_settings,
    save_settings,
    validate_settings,
)
from ..utils import utc_now

backup_blueprint = Blueprint("backup", __name__)


@backup_blueprint.get("/api/export")
def export_data():
    with db_connection() as db:
        payload = {
            "app": "Dialed In",
            "version": 2,
            "exportedAt": utc_now(),
            "settings": get_settings(db),
            "recipes": list_recipes(db),
        }

    content = json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")

    return send_file(
        BytesIO(content),
        as_attachment=True,
        download_name=(
            f"dialed-in-backup-{datetime.now().date().isoformat()}.json"
        ),
        mimetype="application/json",
    )


@backup_blueprint.post("/api/import")
def import_data():
    payload = request.get_json(force=True) or {}
    recipes = payload.get("recipes")

    if not isinstance(recipes, list):
        return jsonify({"error": "Invalid backup file."}), 400

    try:
        cleaned_recipes = [
            validate_recipe_payload(recipe)
            for recipe in recipes
        ]
        settings = validate_settings(payload.get("settings") or {})
    except (ValueError, TypeError) as exc:
        return jsonify({"error": f"Import failed: {exc}"}), 400

    with db_connection() as db:
        recipe_repository.delete_all(db)
        for recipe in cleaned_recipes:
            recipe_repository.insert(db, recipe)
        save_settings(db, settings)

    return jsonify({"imported": len(cleaned_recipes)})
