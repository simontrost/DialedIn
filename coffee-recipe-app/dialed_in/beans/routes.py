from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..database import db_connection
from .service import create_bean, delete_bean, list_beans, update_bean

beans_blueprint = Blueprint("beans", __name__, url_prefix="/api/beans")


@beans_blueprint.get("")
def get_beans():
    with db_connection() as db:
        return jsonify(list_beans(db))


@beans_blueprint.post("")
def post_bean():
    try:
        with db_connection() as db:
            bean = create_bean(db, request.get_json(silent=True) or {})
        return jsonify(bean), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@beans_blueprint.put("/<bean_id>")
def put_bean(bean_id: str):
    try:
        with db_connection() as db:
            bean = update_bean(db, bean_id, request.get_json(silent=True) or {})
        if bean is None:
            return jsonify({"error": "Bean not found."}), 404
        return jsonify(bean)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@beans_blueprint.delete("/<bean_id>")
def remove_bean(bean_id: str):
    with db_connection() as db:
        deleted = delete_bean(db, bean_id)
    if not deleted:
        return jsonify({"error": "Bean not found."}), 404
    return "", 204
