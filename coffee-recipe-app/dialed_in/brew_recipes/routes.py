from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..brewing_methods import list_methods
from ..database import db_connection
from .service import (
    create_brew_recipe,
    delete_brew_recipe,
    list_brew_recipes,
    update_brew_recipe,
)

brew_recipes_blueprint = Blueprint("brew_recipes", __name__)


@brew_recipes_blueprint.get("/api/brewing-methods")
def get_brewing_methods():
    return jsonify(list_methods())


@brew_recipes_blueprint.get("/api/brew-recipes")
def get_brew_recipes():
    with db_connection() as db:
        recipes = list_brew_recipes(db)
    bean_id = request.args.get("beanId")
    method = request.args.get("method")
    if bean_id:
        recipes = [recipe for recipe in recipes if recipe["beanId"] == bean_id]
    if method:
        recipes = [recipe for recipe in recipes if recipe["method"] == method]
    return jsonify(recipes)


@brew_recipes_blueprint.post("/api/brew-recipes")
def post_brew_recipe():
    try:
        with db_connection() as db:
            recipe = create_brew_recipe(db, request.get_json(silent=True) or {})
        return jsonify(recipe), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@brew_recipes_blueprint.put("/api/brew-recipes/<recipe_id>")
def put_brew_recipe(recipe_id: str):
    try:
        with db_connection() as db:
            recipe = update_brew_recipe(db, recipe_id, request.get_json(silent=True) or {})
        if recipe is None:
            return jsonify({"error": "Recipe not found."}), 404
        return jsonify(recipe)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@brew_recipes_blueprint.delete("/api/brew-recipes/<recipe_id>")
def remove_brew_recipe(recipe_id: str):
    with db_connection() as db:
        deleted = delete_brew_recipe(db, recipe_id)
    if not deleted:
        return jsonify({"error": "Recipe not found."}), 404
    return "", 204
