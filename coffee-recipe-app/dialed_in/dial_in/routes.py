from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import db_connection
from .service import create_log, delete_log, list_logs, recommend


dial_in_blueprint = Blueprint("dial_in", __name__)


@dial_in_blueprint.get("/api/dial-in-logs")
def get_logs():
    with db_connection() as db:
        logs = list_logs(db)
    bean_id = request.args.get("beanId")
    recipe_id = request.args.get("recipeId")
    if bean_id:
        logs = [log for log in logs if log["beanId"] == bean_id]
    if recipe_id:
        logs = [log for log in logs if log["brewRecipeId"] == recipe_id]
    return jsonify(logs)


@dial_in_blueprint.post("/api/dial-in-logs")
def post_log():
    try:
        with db_connection() as db:
            log = create_log(db, request.get_json(silent=True) or {})
        return jsonify(log), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@dial_in_blueprint.delete("/api/dial-in-logs/<log_id>")
def remove_log(log_id: str):
    with db_connection() as db:
        deleted = delete_log(db, log_id)
    if not deleted:
        return jsonify({"error": "Measurement not found."}), 404
    return "", 204


@dial_in_blueprint.post("/api/dial-in/recommendation")
def post_recommendation():
    payload = request.get_json(silent=True) or {}
    recipe_id = str(payload.get("recipeId") or "").strip()
    if not recipe_id:
        return jsonify({"error": "Select a recipe first."}), 400
    try:
        max_step = float(payload.get("maxStep", 2.5))
        with db_connection() as db:
            result = recommend(db, recipe_id, max_step=max_step)
        return jsonify(result)
    except (TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400
