from flask import Blueprint, jsonify, request

from ..database import db_connection
from . import service

recipes_blueprint = Blueprint(
    "recipes",
    __name__,
    url_prefix="/api/recipes",
)


@recipes_blueprint.post("")
def create_recipe():
    try:
        payload = request.get_json(force=True) or {}
        with db_connection() as db:
            recipe = service.create_recipe(db, payload)
        return jsonify(recipe), 201
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@recipes_blueprint.put("/<recipe_id>")
def update_recipe(recipe_id: str):
    try:
        payload = request.get_json(force=True) or {}
        with db_connection() as db:
            recipe = service.update_recipe(db, recipe_id, payload)

        if recipe is None:
            return jsonify({"error": "Recipe not found."}), 404

        return jsonify(recipe)
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@recipes_blueprint.delete("/<recipe_id>")
def delete_recipe(recipe_id: str):
    with db_connection() as db:
        deleted = service.delete_recipe(db, recipe_id)

    if not deleted:
        return jsonify({"error": "Recipe not found."}), 404

    return "", 204
