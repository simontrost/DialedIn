from __future__ import annotations

import ipaddress
import json
import re
import socket
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

from ..utils import fold_text, normalize_text
from .coffee_detection import detect_blend, detect_countries, detect_region

MAX_SCRAPE_BYTES = 2_000_000
MAX_REDIRECTS = 5

GENERIC_BRANDS = {
    "shop",
    "store",
    "coffee",
    "espresso",
    "product",
    "products",
    "online shop",
    "shopify",
    "woocommerce",
    "home",
    "amazon",
    "etsy",
}


class ScrapeError(ValueError):
    pass


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
    if hostname == "localhost" or hostname.endswith(
        (".local", ".internal", ".lan", ".home")
    ):
        raise ScrapeError("Local network addresses cannot be scraped.")

    try:
        addresses = {
            item[4][0].split("%", 1)[0]
            for item in socket.getaddrinfo(
                hostname,
                parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
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
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc,
            clean_path,
            parsed.params,
            parsed.query,
            "",
        )
    )


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
    for script in soup.find_all(
        "script",
        attrs={"type": re.compile("ld\\+json", re.I)},
    ):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue

        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue

        for item in iter_json_objects(data):
            product_type = item.get("@type")
            types = product_type if isinstance(product_type, list) else [product_type]
            if any(str(value).lower() == "product" for value in types if value):
                return item

    return {}


def meta_content(
    soup: BeautifulSoup,
    *,
    property_name: str | None = None,
    name: str | None = None,
) -> str:
    attributes: dict[str, str] = {}
    if property_name:
        attributes["property"] = property_name
    if name:
        attributes["name"] = name

    tag = soup.find("meta", attrs=attributes)
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
    h1 = (
        normalize_text(soup.find("h1").get_text(" ", strip=True))
        if soup.find("h1")
        else ""
    )
    title = (
        normalize_text(soup.title.get_text(" ", strip=True))
        if soup.title
        else ""
    )
    name = clean_name(product_name or og_title or h1 or title, site_name)

    roaster = brand_from_product(product)
    if not is_useful_brand(roaster):
        roaster = site_name if is_useful_brand(site_name) else ""

    descriptions: list[str] = []
    product_description = product.get("description")
    if product_description:
        descriptions.append(
            BeautifulSoup(
                str(product_description),
                "html.parser",
            ).get_text(" ", strip=True)
        )

    descriptions.extend(
        filter(
            None,
            [
                meta_content(soup, property_name="og:description"),
                meta_content(soup, name="description"),
            ],
        )
    )

    main = soup.find("main") or soup.find("article")
    if main:
        descriptions.append(main.get_text(" ", strip=True)[:120_000])
    elif soup.body:
        descriptions.append(soup.body.get_text(" ", strip=True)[:80_000])

    product_text = normalize_text(" ".join([name, roaster, *descriptions]))
    countries = detect_countries(product_text)

    if len(countries) == 1:
        origin_country = countries[0]
    elif len(countries) > 1:
        origin_country = "Multiple origins"
    else:
        origin_country = ""

    origin_region = (
        detect_region(product_text, origin_country)
        if origin_country not in {"", "Multiple origins"}
        else ""
    )
    blend = detect_blend(product_text)

    return {
        "name": name,
        "roaster": roaster,
        "originCountry": origin_country,
        "originRegion": origin_region,
        "blend": blend,
        "finalUrl": final_url,
    }
