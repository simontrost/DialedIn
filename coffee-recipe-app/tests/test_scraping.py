from __future__ import annotations

import pytest

from dialed_in.scraping.coffee_detection import (
    detect_blend,
    detect_countries,
    detect_region,
)
from dialed_in.scraping.scraper import ScrapeError, parse_product_page, validate_public_url


def test_detects_origin_region_and_blend() -> None:
    text = "A 70% Arabica and 30% Robusta blend from Ethiopia Guji."

    assert detect_countries(text) == ["Ethiopia"]
    assert detect_region(text, "Ethiopia") == "Guji"
    assert detect_blend(text) == "70% Arabica / 30% Robusta"


def test_parses_product_json_ld() -> None:
    html = b"""
    <html>
      <head>
        <meta property="og:site_name" content="North Star Roastery">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Guji Espresso",
            "brand": {"@type": "Brand", "name": "North Star Roastery"},
            "description": "100% Arabica dark roast from Ethiopia, Guji."
          }
        </script>
      </head>
      <body><main>Coffee from Ethiopia Guji.</main></body>
    </html>
    """

    result = parse_product_page(html, "https://example.test/guji")

    assert result == {
        "name": "Guji Espresso",
        "roaster": "North Star Roastery",
        "originCountry": "Ethiopia",
        "originRegion": "Guji",
        "blend": "100% Arabica",
        "finalUrl": "https://example.test/guji",
    }


def test_rejects_local_scraping_targets() -> None:
    with pytest.raises(ScrapeError, match="Local network addresses"):
        validate_public_url("http://localhost/product")
