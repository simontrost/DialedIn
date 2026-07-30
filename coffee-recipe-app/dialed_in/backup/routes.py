from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, Response, jsonify, request

from ..beans.repository import insert as insert_bean
from ..beans.service import list_beans
from ..beans.validation import validate_bean
from ..brew_recipes.repository import insert as insert_brew_recipe
from ..brew_recipes.service import list_brew_recipes
from ..brew_recipes.validation import validate_brew_recipe
from ..database import db_connection, utc_now
from ..dial_in.repository import insert as insert_log
from ..dial_in.service import list_logs
from ..dial_in.validation import validate_log
from ..settings.service import get_settings

backup_blueprint = Blueprint("backup", __name__)


def _identifier(prefix: str, value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"dialed-in-backup:{prefix}:{value}"))


def _legacy_to_v2(payload: dict[str, Any]) -> dict[str, Any]:
    beans: list[dict[str, Any]] = []
    brew_recipes: list[dict[str, Any]] = []
    for legacy in payload.get("recipes", []):
        legacy_id = str(legacy.get("id") or uuid.uuid4())
        bean_id = _identifier("bean", legacy_id)
        recipe_id = _identifier("espresso", legacy_id)
        timestamp = str(legacy.get("updatedAt") or utc_now())
        beans.append(
            {
                "id": bean_id,
                "name": legacy.get("name", "Unnamed coffee"),
                "roaster": legacy.get("roaster", ""),
                "originCountry": legacy.get("originCountry", ""),
                "originRegion": legacy.get("originRegion", ""),
                "blend": legacy.get("blend", ""),
                "roast": legacy.get("roast", "medium"),
                "status": legacy.get("status", "active"),
                "orderUrl": legacy.get("orderUrl", ""),
                "notes": "",
                "favorite": legacy.get("favorite", False),
                "createdAt": timestamp,
                "updatedAt": timestamp,
            }
        )
        brew_recipes.append(
            {
                "id": recipe_id,
                "beanId": bean_id,
                "name": "Espresso",
                "method": "espresso",
                "values": {
                    "dose": legacy.get("dose", 18),
                    "beverageYield": legacy.get("yield", 36),
                    "targetTime": legacy.get("time", 28),
                    "grind": legacy.get("grind"),
                    "temperature": legacy.get("temp"),
                    "pressure": 9,
                },
                "steps": [],
                "notes": legacy.get("notes", ""),
                "favorite": legacy.get("favorite", False),
                "createdAt": timestamp,
                "updatedAt": timestamp,
            }
        )
    return {
        "version": 2,
        "settings": payload.get("settings", {}),
        "beans": beans,
        "brewRecipes": brew_recipes,
        "dialInLogs": [],
    }


@backup_blueprint.get("/api/export")
def export_data():
    with db_connection() as db:
        payload = {
            "version": 2,
            "generatedAt": utc_now(),
            "settings": get_settings(db),
            "beans": list_beans(db),
            "brewRecipes": list_brew_recipes(db),
            "dialInLogs": list_logs(db),
        }
    filename = f"dialed-in-backup-{datetime.now().strftime('%Y-%m-%d')}.json"
    return Response(
        json.dumps(payload, ensure_ascii=False, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@backup_blueprint.post("/api/import")
def import_data():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "The backup must contain a JSON object."}), 400
    if "beans" not in payload and "recipes" in payload:
        payload = _legacy_to_v2(payload)

    raw_beans = payload.get("beans", [])
    raw_recipes = payload.get("brewRecipes", [])
    raw_logs = payload.get("dialInLogs", [])
    if not all(isinstance(items, list) for items in (raw_beans, raw_recipes, raw_logs)):
        return jsonify({"error": "Invalid backup structure."}), 400

    try:
        with db_connection() as db:
            db.execute("DELETE FROM dial_in_logs")
            db.execute("DELETE FROM brew_recipes")
            db.execute("DELETE FROM beans")

            bean_ids: set[str] = set()
            for raw in raw_beans:
                clean = validate_bean(raw)
                timestamp = str(raw.get("updatedAt") or utc_now())
                bean = {
                    "id": str(raw.get("id") or uuid.uuid4()),
                    **clean,
                    "createdAt": str(raw.get("createdAt") or timestamp),
                    "updatedAt": timestamp,
                }
                insert_bean(db, bean)
                bean_ids.add(bean["id"])

            recipe_ids: set[str] = set()
            for raw in raw_recipes:
                clean = validate_brew_recipe(raw)
                if clean["beanId"] not in bean_ids:
                    raise ValueError("A recipe refers to a missing bean.")
                timestamp = str(raw.get("updatedAt") or utc_now())
                recipe = {
                    "id": str(raw.get("id") or uuid.uuid4()),
                    **clean,
                    "createdAt": str(raw.get("createdAt") or timestamp),
                    "updatedAt": timestamp,
                }
                insert_brew_recipe(db, recipe)
                recipe_ids.add(recipe["id"])

            for raw in raw_logs:
                clean = validate_log(raw)
                if clean["beanId"] not in bean_ids or clean["brewRecipeId"] not in recipe_ids:
                    raise ValueError("A measurement refers to a missing bean or recipe.")
                log = {
                    "id": str(raw.get("id") or uuid.uuid4()),
                    **clean,
                    "createdAt": str(raw.get("createdAt") or utc_now()),
                }
                insert_log(db, log)

            settings = payload.get("settings")
            if isinstance(settings, dict):
                for key in (
                    "machine", "grinder", "theme", "grindMin", "grindMax",
                    "machineTemperatureControl", "machinePressureControl", "machineFlowControl",
                ):
                    if key in settings:
                        value = str(settings[key]).strip()
                        if key == "theme" and value not in {"light", "dark"}:
                            value = "light"
                        db.execute(
                            "INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)",
                            (key, value),
                        )
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400

    counts = {
        "beans": len(raw_beans),
        "recipes": len(raw_recipes),
        "measurements": len(raw_logs),
    }
    return jsonify({**counts, "imported": sum(counts.values())})
