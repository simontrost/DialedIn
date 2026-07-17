from flask import Blueprint, jsonify, request

from .scraper import ScrapeError, fetch_public_html, parse_product_page

scraping_blueprint = Blueprint("scraping", __name__)


@scraping_blueprint.post("/api/scrape-product")
def scrape_product():
    payload = request.get_json(force=True) or {}

    try:
        content, final_url = fetch_public_html(str(payload.get("url", "")))
        return jsonify(parse_product_page(content, final_url))
    except ScrapeError as exc:
        return jsonify({"error": str(exc)}), 400
