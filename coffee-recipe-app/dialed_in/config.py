import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent


class Config:
    JSON_SORT_KEYS = False
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024
    SECRET_KEY = os.environ.get("SECRET_KEY", "dialed-in-local-profile-session")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    DB_PATH = Path(
        os.environ.get(
            "DB_PATH",
            PROJECT_DIR / "data" / "coffee.db",
        )
    )
    PROFILE_REGISTRY_PATH = os.environ.get("PROFILE_REGISTRY_PATH")
    PROFILE_DATABASE_DIR = os.environ.get("PROFILE_DATABASE_DIR")
    DEFAULT_PROFILE_NAME = os.environ.get("DEFAULT_PROFILE_NAME", "Main profile")

    PROFILE_IMAGE_MAX_BYTES = 1024 * 1024
