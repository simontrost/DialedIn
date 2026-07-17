from __future__ import annotations

import re
from typing import Any

import requests

from ..scraping.coffee_detection import (
    detect_blend,
    detect_countries,
    detect_region,
)
from ..utils import fold_text, normalize_text


OPEN_FOOD_FACTS_PRODUCT_URL = (
    "https://world.openfoodfacts.org/api/v2/product/{barcode}"
)
OPEN_FOOD_FACTS_FIELDS = (
    "code,"
    "product_name,"
    "product_name_de,"
    "generic_name,"
    "generic_name_de,"
    "brands,"
    "origins,"
    "labels,"
    "categories,"
    "ingredients_text,"
    "quantity,"
    "image_front_url"
)
USER_AGENT = (
    "DialedIn/1.0 "
    "(https://github.com/simontrost/DialedIn; "
    "local coffee recipe application)"
)


class InvalidBarcodeError(ValueError):
    """The supplied barcode is malformed or has an invalid check digit."""


class BarcodeNotFoundError(LookupError):
    """No product exists for the supplied barcode at the provider."""


class BarcodeProviderError(RuntimeError):
    """The external product database could not be queried reliably."""


def normalize_barcode(value: Any) -> str:
    """Normalize and validate a GTIN-8, UPC-A, EAN-13, or GTIN-14."""

    barcode = re.sub(r"[\s-]+", "", normalize_text(value))

    if not barcode:
        raise InvalidBarcodeError("Enter or scan a barcode first.")

    if not barcode.isdigit():
        raise InvalidBarcodeError("The barcode may only contain digits.")

    if len(barcode) not in {8, 12, 13, 14}:
        raise InvalidBarcodeError(
            "The barcode must contain 8, 12, 13, or 14 digits."
        )

    if not has_valid_gtin_check_digit(barcode):
        raise InvalidBarcodeError("The barcode check digit is invalid.")

    return barcode


def has_valid_gtin_check_digit(barcode: str) -> bool:
    """Validate the final GS1/GTIN check digit."""

    body = barcode[:-1]
    supplied_check_digit = int(barcode[-1])

    weighted_sum = 0
    for index, character in enumerate(reversed(body)):
        weight = 3 if index % 2 == 0 else 1
        weighted_sum += int(character) * weight

    expected_check_digit = (10 - weighted_sum % 10) % 10
    return supplied_check_digit == expected_check_digit


def lookup_barcode_product(value: Any) -> dict[str, Any]:
    """Fetch a product from Open Food Facts and map it to Dialed In fields."""

    barcode = normalize_barcode(value)

    try:
        response = requests.get(
            OPEN_FOOD_FACTS_PRODUCT_URL.format(barcode=barcode),
            params={"fields": OPEN_FOOD_FACTS_FIELDS},
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Language": "de,en;q=0.8",
            },
            timeout=(4, 10),
        )
    except requests.RequestException as exc:
        raise BarcodeProviderError(
            "Open Food Facts could not be reached."
        ) from exc

    if response.status_code == 429:
        raise BarcodeProviderError(
            "Open Food Facts temporarily rejected too many requests."
        )

    if response.status_code >= 500:
        raise BarcodeProviderError(
            "Open Food Facts is temporarily unavailable."
        )

    try:
        response.raise_for_status()
    except requests.RequestException as exc:
        raise BarcodeProviderError(
            f"Open Food Facts returned HTTP {response.status_code}."
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise BarcodeProviderError(
            "Open Food Facts returned an invalid response."
        ) from exc

    if data.get("status") != 1 or not isinstance(data.get("product"), dict):
        raise BarcodeNotFoundError(
            f"No product was found for barcode {barcode}."
        )

    return map_open_food_facts_product(barcode, data["product"])


def map_open_food_facts_product(
    barcode: str,
    product: dict[str, Any],
) -> dict[str, Any]:
    """Convert Open Food Facts fields to the current recipe form fields."""

    name = first_text(
        product,
        "product_name_de",
        "product_name",
        "generic_name_de",
        "generic_name",
    )
    brands = value_as_text(product.get("brands"))
    roaster = brands.split(",", 1)[0].strip()

    origins = value_as_text(product.get("origins"))
    labels = value_as_text(product.get("labels"))
    categories = value_as_text(product.get("categories"))
    ingredients = value_as_text(product.get("ingredients_text"))

    product_text = normalize_text(
        " ".join(
            part
            for part in (
                name,
                brands,
                origins,
                labels,
                categories,
                ingredients,
            )
            if part
        )
    )

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

    return {
        "barcode": barcode,
        "source": "open_food_facts",
        "name": name[:60],
        "roaster": roaster[:60],
        "originCountry": origin_country,
        "originRegion": origin_region,
        "blend": detect_blend(product_text)[:80],
        "roast": detect_roast_level(product_text),
        "quantity": value_as_text(product.get("quantity"))[:40],
        "imageUrl": value_as_text(product.get("image_front_url"))[:500],
        "sourceProductUrl": (
            f"https://world.openfoodfacts.org/product/{barcode}"
        ),
    }


def first_text(product: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = value_as_text(product.get(key))
        if value:
            return value
    return ""


def value_as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return normalize_text(" ".join(str(item) for item in value if item))
    return normalize_text(value)


def detect_roast_level(text: str) -> str:
    """Return a roast only when the product text states it explicitly."""

    folded = fold_text(text)

    patterns = (
        ("dark", r"\b(dark roast|dark roasted|dunkle roestung|dunkel)\b"),
        ("medium", r"\b(medium roast|medium roasted|mittlere roestung|mittel)\b"),
        ("light", r"\b(light roast|light roasted|helle roestung|hell)\b"),
    )

    for roast, pattern in patterns:
        if re.search(pattern, folded):
            return roast

    return ""
