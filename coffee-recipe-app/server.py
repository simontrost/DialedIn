from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import socket
import sqlite3
import unicodedata
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_file, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "data" / "coffee.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=None)
app.config["JSON_SORT_KEYS"] = False
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024

PUBLIC_ASSETS = {"styles.css", "app.js", "manifest.webmanifest", "icon.svg"}
MAX_SCRAPE_BYTES = 2_000_000
MAX_REDIRECTS = 5

ORIGIN_REGIONS: dict[str, list[str]] = {
    "Brazil": ["Cerrado Mineiro", "Espírito Santo", "Mogiana", "Minas Gerais", "Sul de Minas"],
    "Burundi": ["Kayanza", "Kirundo", "Ngozi"],
    "Colombia": ["Antioquia", "Cauca", "Huila", "Nariño", "Sierra Nevada", "Tolima"],
    "Costa Rica": ["Brunca", "Central Valley", "Tarrazú", "West Valley"],
    "El Salvador": ["Alotepec-Metapán", "Apaneca-Ilamatepec", "Bálsamo-Quezaltepec"],
    "Ethiopia": ["Guji", "Harrar", "Limu", "Sidama", "Yirgacheffe"],
    "Guatemala": ["Acatenango", "Antigua", "Atitlán", "Cobán", "Huehuetenango"],
    "Honduras": ["Agalta", "Copán", "El Paraíso", "Montecillos", "Opalaca"],
    "India": ["Baba Budangiri", "Chikmagalur", "Coorg", "Kerala"],
    "Indonesia": ["Bali", "Flores", "Java", "Sulawesi", "Sumatra"],
    "Jamaica": ["Blue Mountains"],
    "Kenya": ["Embu", "Kirinyaga", "Kiambu", "Murang'a", "Nyeri"],
    "Mexico": ["Chiapas", "Oaxaca", "Veracruz"],
    "Nicaragua": ["Jinotega", "Matagalpa", "Nueva Segovia"],
    "Panama": ["Boquete", "Volcán"],
    "Papua New Guinea": ["Eastern Highlands", "Western Highlands"],
    "Peru": ["Cajamarca", "Cusco", "Junín", "San Martín"],
    "Rwanda": ["Gakenke", "Huye", "Kivu", "Nyamasheke"],
    "Tanzania": ["Arusha", "Kilimanjaro", "Mbeya"],
    "Uganda": ["Bugisu", "Rwenzori"],
    "Vietnam": ["Central Highlands", "Da Lat"],
    "Yemen": ["Bani Matar", "Haraz", "Haimah"],
}

COUNTRY_ALIASES: dict[str, tuple[str, ...]] = {
    "Brazil": ("brazil", "brasil"),
    "Burundi": ("burundi",),
    "Colombia": ("colombia", "kolumbien"),
    "Costa Rica": ("costa rica",),
    "Cuba": ("cuba", "kuba"),
    "Dominican Republic": ("dominican republic", "dominikanische republik"),
    "Ecuador": ("ecuador",),
    "El Salvador": ("el salvador",),
    "Ethiopia": ("ethiopia", "ethiopian", "äthiopien", "aethiopien"),
    "Guatemala": ("guatemala",),
    "Haiti": ("haiti",),
    "Honduras": ("honduras",),
    "India": ("india", "indian", "indien"),
    "Indonesia": ("indonesia", "indonesian", "indonesien"),
    "Jamaica": ("jamaica", "jamaika"),
    "Kenya": ("kenya", "kenian", "kenia"),
    "Laos": ("laos",),
    "Mexico": ("mexico", "mexican", "mexiko"),
    "Myanmar": ("myanmar", "burma"),
    "Nicaragua": ("nicaragua",),
    "Panama": ("panama",),
    "Papua New Guinea": ("papua new guinea", "papua-neuguinea"),
    "Peru": ("peru",),
    "Philippines": ("philippines", "philippinen"),
    "Rwanda": ("rwanda", "ruanda"),
    "Tanzania": ("tanzania", "tansania"),
    "Thailand": ("thailand",),
    "Timor-Leste": ("timor-leste", "east timor", "osttimor"),
    "Uganda": ("uganda",),
    "Vietnam": ("vietnam", "viet nam"),
    "Yemen": ("yemen", "jemen"),
}

GENERIC_BRANDS = {
    "shop", "store", "coffee", "espresso", "product", "products", "online shop",
    "shopify", "woocommerce", "home", "amazon", "etsy"
}


class ScrapeError(ValueError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def normalize_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def fold_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def word_present(text: str, phrase: str) -> bool:
    folded_text = fold_text(text)
    folded_phrase = fold_text(phrase)
    return re.search(rf"(?<![a-z]){re.escape(folded_phrase)}(?![a-z])", folded_text) is not None


def detect_countries(text: str) -> list[str]:
    found: list[tuple[int, str]] = []
    folded = fold_text(text)
    for country, aliases in COUNTRY_ALIASES.items():
        positions = []
        for alias in aliases:
            match = re.search(rf"(?<![a-z]){re.escape(fold_text(alias))}(?![a-z])", folded)
            if match:
                positions.append(match.start())
        if positions:
            found.append((min(positions), country))
    return [country for _, country in sorted(found)]


def detect_region(text: str, country: str) -> str:
    for region in ORIGIN_REGIONS.get(country, []):
        if word_present(text, region):
            return region
    if country == "Ethiopia" and word_present(text, "Sidamo"):
        return "Sidama"
    return ""


def detect_blend(text: str) -> str:
    folded = fold_text(text)
    arabica = re.search(r"(\d{1,3})\s*(?:%|percent)?\s*arabica", folded)
    robusta = re.search(r"(\d{1,3})\s*(?:%|percent)?\s*robusta", folded)
    if arabica and robusta:
        a = int(arabica.group(1))
        r = int(robusta.group(1))
        if 0 <= a <= 100 and 0 <= r <= 100 and a + r == 100:
            return f"{a}% Arabica / {r}% Robusta"

    if re.search(r"100\s*(?:%|percent)\s*arabica", folded):
        return "100% Arabica"
    if re.search(r"100\s*(?:%|percent)\s*robusta", folded):
        return "100% Robusta"

    ratio = re.search(r"\b(\d{1,3})\s*[/:-]\s*(\d{1,3})\b", folded)
    if ratio and "arabica" in folded and "robusta" in folded:
        a = int(ratio.group(1))
        r = int(ratio.group(2))
        if a + r == 100:
            return f"{a}% Arabica / {r}% Robusta"

    if "arabica" in folded and "robusta" in folded:
        return "Arabica / Robusta blend"
    return ""


def parse_legacy_origin(value: str) -> tuple[str, str, str]:
    text = normalize_text(value)
    if not text:
        return "", "", ""
    countries = detect_countries(text)
    country = countries[0] if len(countries) == 1 else ("Multiple origins" if len(countries) > 1 else "")
    region = detect_region(text, country) if country and country != "Multiple origins" else ""
    blend = detect_blend(text)
    return country, region, blend


def origin_summary(country: str, region: str, blend: str) -> str:
    location = " · ".join(part for part in (country, region) if part)
    return " · ".join(part for part in (location, blend) if part)


def ensure_recipe_columns(db: sqlite3.Connection) -> None:
    existing = {row["name"] for row in db.execute("PRAGMA table_info(recipes)").fetchall()}
    additions = {
        "origin_country": "TEXT NOT NULL DEFAULT ''",
        "origin_region": "TEXT NOT NULL DEFAULT ''",
        "blend": "TEXT NOT NULL DEFAULT ''",
    }
    for name, definition in additions.items():
        if name not in existing:
            db.execute(f"ALTER TABLE recipes ADD COLUMN {name} {definition}")


def migrate_recipe_data(db: sqlite3.Connection) -> None:
    db.execute(
        """
        UPDATE recipes
        SET roast = CASE roast
            WHEN 'hell' THEN 'light'
            WHEN 'mittel' THEN 'medium'
            WHEN 'dunkel' THEN 'dark'
            ELSE roast
        END
        """
    )
    db.execute(
        """
        UPDATE recipes
        SET status = CASE status
            WHEN 'aktiv' THEN 'active'
            WHEN 'leer' THEN 'empty'
            WHEN 'wunschliste' THEN 'wishlist'
            ELSE status
        END
        """
    )

    rows = db.execute(
        "SELECT id, origin, origin_country, origin_region, blend FROM recipes"
    ).fetchall()
    for row in rows:
        if row["origin_country"] or row["origin_region"] or row["blend"]:
            continue
        country, region, blend = parse_legacy_origin(row["origin"])
        db.execute(
            "UPDATE recipes SET origin_country = ?, origin_region = ?, blend = ? WHERE id = ?",
            (country, region, blend, row["id"]),
        )


def init_db() -> None:
    with db_connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                roaster TEXT NOT NULL DEFAULT '',
                origin TEXT NOT NULL DEFAULT '',
                origin_country TEXT NOT NULL DEFAULT '',
                origin_region TEXT NOT NULL DEFAULT '',
                blend TEXT NOT NULL DEFAULT '',
                roast TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'active',
                dose REAL NOT NULL DEFAULT 18,
                yield_amount REAL NOT NULL DEFAULT 36,
                time_seconds INTEGER NOT NULL DEFAULT 28,
                grind TEXT NOT NULL DEFAULT '',
                temp REAL,
                rating REAL NOT NULL DEFAULT 0,
                order_url TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        ensure_recipe_columns(db)
        db.executemany(
            "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
            [
                ("machine", "Gaggia Classic Evo Pro E24"),
                ("grinder", "Turin G-Micron DF64P"),
            ],
        )
        migrate_recipe_data(db)

        existing = db.execute("SELECT COUNT(*) AS amount FROM recipes").fetchone()["amount"]
        if existing == 0:
            seed_recipes(db)


def seed_recipes(db: sqlite3.Connection) -> None:
    examples = [
        {
            "name": "House Blend 70/30",
            "roaster": "Example Roastery",
            "originCountry": "Multiple origins",
            "originRegion": "",
            "blend": "70% Arabica / 30% Robusta",
            "roast": "dark",
            "status": "active",
            "dose": 18,
            "yield": 38,
            "time": 28,
            "grind": "17.5",
            "temp": 93,
            "rating": 4.5,
            "notes": "Bold, chocolatey, and full of crema. A very reliable recipe.",
            "favorite": True,
        },
        {
            "name": "Classic Espresso",
            "roaster": "Example Roastery",
            "originCountry": "Multiple origins",
            "originRegion": "",
            "blend": "50% Arabica / 50% Robusta",
            "roast": "dark",
            "status": "active",
            "dose": 18,
            "yield": 36,
            "time": 27,
            "grind": "18",
            "temp": 92,
            "rating": 4,
            "notes": "Pull the shot slightly shorter if it becomes too bitter.",
            "favorite": False,
        },
        {
            "name": "Single Origin Arabica",
            "roaster": "Example Roastery",
            "originCountry": "Brazil",
            "originRegion": "Minas Gerais",
            "blend": "100% Arabica",
            "roast": "medium",
            "status": "wishlist",
            "dose": 18,
            "yield": 40,
            "time": 30,
            "grind": "16.5",
            "temp": 94,
            "rating": 3.5,
            "notes": "Test recipe: try a longer ratio and a slightly higher temperature.",
            "favorite": False,
        },
    ]
    for recipe in examples:
        insert_recipe(db, recipe)


def row_to_recipe(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "roaster": row["roaster"],
        "originCountry": row["origin_country"],
        "originRegion": row["origin_region"],
        "blend": row["blend"],
        "roast": row["roast"],
        "status": row["status"],
        "dose": row["dose"],
        "yield": row["yield_amount"],
        "time": row["time_seconds"],
        "grind": row["grind"],
        "temp": row["temp"],
        "rating": row["rating"],
        "orderUrl": row["order_url"],
        "notes": row["notes"],
        "favorite": bool(row["favorite"]),
        "updatedAt": row["updated_at"],
    }


def clean_recipe(payload: dict[str, Any], recipe_id: str | None = None) -> dict[str, Any]:
    name = normalize_text(payload.get("name"))
    if not name:
        raise ValueError("The coffee name cannot be empty.")

    roast_aliases = {
        "light": "light", "medium": "medium", "dark": "dark",
        "hell": "light", "mittel": "medium", "dunkel": "dark",
    }
    status_aliases = {
        "active": "active", "empty": "empty", "wishlist": "wishlist",
        "aktiv": "active", "leer": "empty", "wunschliste": "wishlist",
    }
    roast = roast_aliases.get(str(payload.get("roast", "medium")).lower())
    status = status_aliases.get(str(payload.get("status", "active")).lower())
    if roast is None:
        raise ValueError("Invalid roast level.")
    if status is None:
        raise ValueError("Invalid status.")

    origin_country = normalize_text(payload.get("originCountry"))[:50]
    origin_region = normalize_text(payload.get("originRegion"))[:60]
    blend = normalize_text(payload.get("blend"))[:80]
    if not (origin_country or origin_region or blend) and payload.get("origin"):
        origin_country, origin_region, blend = parse_legacy_origin(str(payload.get("origin")))

    dose = float(payload.get("dose", 18))
    yield_amount = float(payload.get("yield", 36))
    time_seconds = int(float(payload.get("time", 28)))
    rating = float(payload.get("rating", 0) or 0)
    temp_value = payload.get("temp")
    temp = float(temp_value) if temp_value not in (None, "") else None

    if not 1 <= dose <= 40:
        raise ValueError("Dose must be between 1 and 40 g.")
    if not 1 <= yield_amount <= 100:
        raise ValueError("Yield must be between 1 and 100 g.")
    if not 1 <= time_seconds <= 120:
        raise ValueError("Time must be between 1 and 120 seconds.")
    if not 0 <= rating <= 5:
        raise ValueError("Rating must be between 0 and 5.")
    if temp is not None and not 70 <= temp <= 110:
        raise ValueError("Temperature must be between 70 and 110 °C.")

    return {
        "id": recipe_id or str(payload.get("id") or uuid.uuid4()),
        "name": name[:60],
        "roaster": normalize_text(payload.get("roaster"))[:60],
        "originCountry": origin_country,
        "originRegion": origin_region,
        "blend": blend,
        "origin": origin_summary(origin_country, origin_region, blend)[:160],
        "roast": roast,
        "status": status,
        "dose": dose,
        "yield": yield_amount,
        "time": time_seconds,
        "grind": normalize_text(payload.get("grind"))[:20],
        "temp": temp,
        "rating": rating,
        "orderUrl": normalize_text(payload.get("orderUrl"))[:500],
        "notes": normalize_text(payload.get("notes"))[:500],
        "favorite": bool(payload.get("favorite", False)),
        "updatedAt": utc_now(),
    }


def insert_recipe(db: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    recipe = clean_recipe(payload)
    db.execute(
        """
        INSERT INTO recipes (
            id, name, roaster, origin, origin_country, origin_region, blend,
            roast, status, dose, yield_amount, time_seconds, grind, temp,
            rating, order_url, notes, favorite, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            recipe["id"], recipe["name"], recipe["roaster"], recipe["origin"],
            recipe["originCountry"], recipe["originRegion"], recipe["blend"],
            recipe["roast"], recipe["status"], recipe["dose"], recipe["yield"],
            recipe["time"], recipe["grind"], recipe["temp"], recipe["rating"],
            recipe["orderUrl"], recipe["notes"], int(recipe["favorite"]), recipe["updatedAt"],
        ),
    )
    return recipe


def state_payload(db: sqlite3.Connection) -> dict[str, Any]:
    settings_rows = db.execute("SELECT key, value FROM settings").fetchall()
    recipes_rows = db.execute(
        "SELECT * FROM recipes ORDER BY favorite DESC, updated_at DESC"
    ).fetchall()
    return {
        "settings": {row["key"]: row["value"] for row in settings_rows},
        "recipes": [row_to_recipe(row) for row in recipes_rows],
    }


def validate_public_url(raw_url: str) -> str:
    raw_url = normalize_text(raw_url)
    if not raw_url:
        raise ScrapeError("Enter a product link first.")
    if not re.match(r"^https?://", raw_url, re.IGNORECASE):
        raw_url = f"https://{raw_url}"

    parsed = urlparse(raw_url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ScrapeError("Only valid http and https links can be imported.")
    if parsed.username or parsed.password:
        raise ScrapeError("Links containing login credentials are not supported.")
    if parsed.port and parsed.port not in {80, 443}:
        raise ScrapeError("Only standard web ports 80 and 443 are allowed.")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith((".local", ".internal", ".lan", ".home")):
        raise ScrapeError("Local network addresses cannot be scraped.")

    try:
        addresses = {
            item[4][0].split("%", 1)[0]
            for item in socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise ScrapeError("The shop hostname could not be resolved.") from exc

    if not addresses:
        raise ScrapeError("The shop hostname could not be resolved.")
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError as exc:
            raise ScrapeError("The shop returned an invalid network address.") from exc
        if not ip.is_global:
            raise ScrapeError("Local or private network addresses cannot be scraped.")

    clean_path = parsed.path or "/"
    return urlunparse((parsed.scheme.lower(), parsed.netloc, clean_path, parsed.params, parsed.query, ""))


def fetch_public_html(raw_url: str) -> tuple[bytes, str]:
    session = requests.Session()
    session.trust_env = False
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 Chrome/124 Safari/537.36 DialedIn/2.0",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en,de;q=0.8",
    }
    current_url = raw_url

    for _ in range(MAX_REDIRECTS + 1):
        current_url = validate_public_url(current_url)
        try:
            response = session.get(
                current_url,
                headers=headers,
                timeout=(5, 12),
                allow_redirects=False,
                stream=True,
            )
        except requests.RequestException as exc:
            raise ScrapeError("The shop page could not be reached.") from exc

        if response.is_redirect or response.is_permanent_redirect:
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise ScrapeError("The shop returned an invalid redirect.")
            current_url = urljoin(current_url, location)
            continue

        if response.status_code in {401, 403}:
            response.close()
            raise ScrapeError("The shop blocked the automatic request.")
        if response.status_code >= 400:
            status = response.status_code
            response.close()
            raise ScrapeError(f"The shop returned HTTP {status}.")

        content_type = response.headers.get("Content-Type", "").lower()
        if "html" not in content_type and "xhtml" not in content_type:
            response.close()
            raise ScrapeError("The link does not point to an HTML product page.")

        content = bytearray()
        for chunk in response.iter_content(chunk_size=32_768):
            if not chunk:
                continue
            content.extend(chunk)
            if len(content) > MAX_SCRAPE_BYTES:
                response.close()
                raise ScrapeError("The product page is too large to import safely.")
        response.close()
        return bytes(content), current_url

    raise ScrapeError("The shop redirected too many times.")


def iter_json_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_json_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_json_objects(child)


def extract_product_json(soup: BeautifulSoup) -> dict[str, Any]:
    for script in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        for obj in iter_json_objects(data):
            product_type = obj.get("@type")
            types = product_type if isinstance(product_type, list) else [product_type]
            if any(str(item).lower() == "product" for item in types if item):
                return obj
    return {}


def meta_content(soup: BeautifulSoup, *, property_name: str | None = None, name: str | None = None) -> str:
    attrs: dict[str, str] = {}
    if property_name:
        attrs["property"] = property_name
    if name:
        attrs["name"] = name
    tag = soup.find("meta", attrs=attrs)
    return normalize_text(tag.get("content")) if tag and tag.get("content") else ""


def brand_from_product(product: dict[str, Any]) -> str:
    for key in ("brand", "manufacturer"):
        value = product.get(key)
        if isinstance(value, dict):
            value = value.get("name")
        cleaned = normalize_text(value)
        if cleaned:
            return cleaned
    return ""


def clean_name(name: str, site_name: str) -> str:
    name = normalize_text(name)
    site_name = normalize_text(site_name)
    if site_name:
        for separator in (" | ", " – ", " — ", " - "):
            suffix = f"{separator}{site_name}"
            prefix = f"{site_name}{separator}"
            if name.lower().endswith(suffix.lower()):
                name = name[:-len(suffix)].strip()
            elif name.lower().startswith(prefix.lower()):
                name = name[len(prefix):].strip()
    name = re.sub(r"^(buy|shop)\s+", "", name, flags=re.I)
    return name[:60]


def is_useful_brand(value: str) -> bool:
    folded = fold_text(value).strip()
    return bool(folded) and folded not in GENERIC_BRANDS and len(value) <= 60


def parse_product_page(content: bytes, final_url: str) -> dict[str, str]:
    soup = BeautifulSoup(content, "html.parser")
    product = extract_product_json(soup)

    site_name = meta_content(soup, property_name="og:site_name")
    product_name = normalize_text(product.get("name"))
    og_title = meta_content(soup, property_name="og:title")
    h1 = normalize_text(soup.find("h1").get_text(" ", strip=True)) if soup.find("h1") else ""
    title = normalize_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
    name = clean_name(product_name or og_title or h1 or title, site_name)

    roaster = brand_from_product(product)
    if not is_useful_brand(roaster):
        roaster = site_name if is_useful_brand(site_name) else ""

    descriptions: list[str] = []
    product_description = product.get("description")
    if product_description:
        descriptions.append(BeautifulSoup(str(product_description), "html.parser").get_text(" ", strip=True))
    descriptions.extend(filter(None, [
        meta_content(soup, property_name="og:description"),
        meta_content(soup, name="description"),
    ]))
    main = soup.find("main") or soup.find("article")
    if main:
        descriptions.append(main.get_text(" ", strip=True)[:120_000])
    else:
        body = soup.body
        if body:
            descriptions.append(body.get_text(" ", strip=True)[:80_000])

    product_text = normalize_text(" ".join([name, roaster, *descriptions]))
    countries = detect_countries(product_text)
    if len(countries) == 1:
        origin_country = countries[0]
    elif len(countries) > 1:
        origin_country = "Multiple origins"
    else:
        origin_country = ""
    origin_region = detect_region(product_text, origin_country) if origin_country not in {"", "Multiple origins"} else ""
    blend = detect_blend(product_text)

    return {
        "name": name,
        "roaster": roaster,
        "originCountry": origin_country,
        "originRegion": origin_region,
        "blend": blend,
        "finalUrl": final_url,
    }


@app.get("/api/state")
def get_state():
    with db_connection() as db:
        return jsonify(state_payload(db))


@app.post("/api/recipes")
def create_recipe():
    try:
        with db_connection() as db:
            recipe = insert_recipe(db, request.get_json(force=True) or {})
        return jsonify(recipe), 201
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.put("/api/recipes/<recipe_id>")
def update_recipe(recipe_id: str):
    try:
        recipe = clean_recipe(request.get_json(force=True) or {}, recipe_id)
        with db_connection() as db:
            exists = db.execute("SELECT 1 FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
            if not exists:
                return jsonify({"error": "Recipe not found."}), 404

            db.execute(
                """
                UPDATE recipes SET
                    name = ?, roaster = ?, origin = ?, origin_country = ?, origin_region = ?, blend = ?,
                    roast = ?, status = ?, dose = ?, yield_amount = ?, time_seconds = ?, grind = ?,
                    temp = ?, rating = ?, order_url = ?, notes = ?, favorite = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    recipe["name"], recipe["roaster"], recipe["origin"], recipe["originCountry"],
                    recipe["originRegion"], recipe["blend"], recipe["roast"], recipe["status"],
                    recipe["dose"], recipe["yield"], recipe["time"], recipe["grind"], recipe["temp"],
                    recipe["rating"], recipe["orderUrl"], recipe["notes"], int(recipe["favorite"]),
                    recipe["updatedAt"], recipe_id,
                ),
            )
        return jsonify(recipe)
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400


@app.delete("/api/recipes/<recipe_id>")
def delete_recipe(recipe_id: str):
    with db_connection() as db:
        result = db.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        if result.rowcount == 0:
            return jsonify({"error": "Recipe not found."}), 404
    return "", 204


@app.post("/api/scrape-product")
def scrape_product():
    payload = request.get_json(force=True) or {}
    try:
        content, final_url = fetch_public_html(str(payload.get("url", "")))
        return jsonify(parse_product_page(content, final_url))
    except ScrapeError as exc:
        return jsonify({"error": str(exc)}), 400


@app.put("/api/settings")
def update_settings():
    payload = request.get_json(force=True) or {}
    machine = normalize_text(payload.get("machine"))[:80] or "Gaggia Classic Evo Pro E24"
    grinder = normalize_text(payload.get("grinder"))[:80] or "Turin G-Micron DF64P"

    with db_connection() as db:
        db.executemany(
            """
            INSERT INTO settings(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            [("machine", machine), ("grinder", grinder)],
        )
    return jsonify({"machine": machine, "grinder": grinder})


@app.get("/api/export")
def export_data():
    with db_connection() as db:
        payload = {
            "app": "Dialed In",
            "version": 2,
            "exportedAt": utc_now(),
            **state_payload(db),
        }

    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return send_file(
        BytesIO(content),
        as_attachment=True,
        download_name=f"dialed-in-backup-{datetime.now().date().isoformat()}.json",
        mimetype="application/json",
    )


@app.post("/api/import")
def import_data():
    payload = request.get_json(force=True) or {}
    recipes = payload.get("recipes")
    if not isinstance(recipes, list):
        return jsonify({"error": "Invalid backup file."}), 400

    try:
        cleaned = [clean_recipe(item) for item in recipes]
    except (ValueError, TypeError) as exc:
        return jsonify({"error": f"Import failed: {exc}"}), 400

    settings = payload.get("settings") or {}
    machine = normalize_text(settings.get("machine"))[:80] or "Gaggia Classic Evo Pro E24"
    grinder = normalize_text(settings.get("grinder"))[:80] or "Turin G-Micron DF64P"

    with db_connection() as db:
        db.execute("DELETE FROM recipes")
        for recipe in cleaned:
            insert_recipe(db, recipe)
        db.executemany(
            """
            INSERT INTO settings(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            [("machine", machine), ("grinder", grinder)],
        )
    return jsonify({"imported": len(cleaned)})


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:asset_path>")
def static_assets(asset_path: str):
    if asset_path not in PUBLIC_ASSETS:
        return jsonify({"error": "File not found."}), 404
    return send_from_directory(BASE_DIR, asset_path)


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), debug=False)
