from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, render_template

from .backup.routes import backup_blueprint
from .barcode.routes import barcode_blueprint
from .beans.routes import beans_blueprint
from .beans.service import list_beans
from .brewing_methods import list_methods
from .brew_recipes.routes import brew_recipes_blueprint
from .brew_recipes.service import list_brew_recipes
from .database import db_connection, init_db
from .dial_in.routes import dial_in_blueprint
from .dial_in.service import list_logs
from .profiles import profiles_blueprint
from .profiles.service import (
    ProfileRequiredError,
    get_active_profile,
    init_profile_store,
    list_profile_records,
)
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

    db_path = Path(app.config["DB_PATH"])
    app.config["DB_PATH"] = db_path
    app.config["PROFILE_REGISTRY_PATH"] = Path(
        app.config.get("PROFILE_REGISTRY_PATH") or db_path.parent / "profiles.db"
    )
    app.config["PROFILE_DATABASE_DIR"] = Path(
        app.config.get("PROFILE_DATABASE_DIR") or db_path.parent / "profiles"
    )

    app.register_blueprint(beans_blueprint)
    app.register_blueprint(brew_recipes_blueprint)
    app.register_blueprint(dial_in_blueprint)
    app.register_blueprint(settings_blueprint)
    app.register_blueprint(scraping_blueprint)
    app.register_blueprint(barcode_blueprint)
    app.register_blueprint(backup_blueprint)
    app.register_blueprint(profiles_blueprint)

    @app.errorhandler(ProfileRequiredError)
    def profile_required(error: ProfileRequiredError):
        return jsonify({"error": str(error), "code": "profile_required"}), 401

    @app.get("/api/state")
    def get_state():
        with db_connection() as db:
            return jsonify(
                {
                    "profile": get_active_profile(),
                    "settings": get_settings(db),
                    "beans": list_beans(db),
                    "brewRecipes": list_brew_recipes(db),
                    "dialInLogs": list_logs(db),
                    "brewingMethods": list_methods(),
                }
            )

    @app.get("/")
    def index():
        return render_template("index.html")

    with app.app_context():
        init_profile_store()
        for profile in list_profile_records():
            init_db(profile["databasePath"], seed=profile["isDefault"])

    return app
