from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, render_template, send_from_directory

from .backup.routes import backup_blueprint
from .database import db_connection, init_db
from .recipes.routes import recipes_blueprint
from .recipes.service import list_recipes
from .scraping.routes import scraping_blueprint
from .settings.routes import settings_blueprint
from .settings.service import get_settings

PUBLIC_ASSETS = {
    "styles.css": Path("css") / "styles.css",
    "app.js": Path("js") / "app.js",
    "manifest.webmanifest": Path("manifest.webmanifest"),
    "icon.svg": Path("icons") / "icon.svg",
}


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

    # Temporary compatibility routes. The current HTML still requests the
    # frontend files from /app.js, /styles.css, /icon.svg, and
    # /manifest.webmanifest. They can be changed to /static/... later when
    # the JavaScript/frontend refactor begins.
    @app.get("/<path:asset_path>")
    def legacy_static_assets(asset_path: str):
        relative_path = PUBLIC_ASSETS.get(asset_path)
        if relative_path is None:
            return jsonify({"error": "File not found."}), 404

        return send_from_directory(
            app.static_folder,
            str(relative_path).replace("\\", "/"),
        )

    with app.app_context():
        init_db()

    return app
