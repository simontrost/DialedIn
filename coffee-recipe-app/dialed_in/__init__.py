from __future__ import annotations

from flask import Flask, jsonify, render_template

from .backup.routes import backup_blueprint
from .barcode.routes import barcode_blueprint
from .database import db_connection, init_db
from .recipes.routes import recipes_blueprint
from .recipes.service import list_recipes
from .scraping.routes import scraping_blueprint
from .settings.routes import settings_blueprint
from .settings.service import get_settings


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )
    app.config.from_object("dialed_in.config.Config")

    if test_config:
        app.config.update(test_config)

    app.register_blueprint(recipes_blueprint)
    app.register_blueprint(settings_blueprint)
    app.register_blueprint(scraping_blueprint)
    app.register_blueprint(barcode_blueprint)
    app.register_blueprint(backup_blueprint)

    @app.get("/api/state")
    def get_state():
        with db_connection() as db:
            return jsonify(
                {
                    "settings": get_settings(db),
                    "recipes": list_recipes(db),
                }
            )

    @app.get("/")
    def index():
        return render_template("index.html")

    with app.app_context():
        init_db()

    return app
