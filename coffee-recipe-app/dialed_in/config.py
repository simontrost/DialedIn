import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent


class Config:
    JSON_SORT_KEYS = False
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024
    DB_PATH = Path(
        os.environ.get(
            "DB_PATH",
            PROJECT_DIR / "data" / "coffee.db",
        )
    )
