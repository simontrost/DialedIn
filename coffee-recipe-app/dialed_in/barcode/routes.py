from __future__ import annotations

from flask import Blueprint, jsonify, request

from .service import (
    BarcodeNotFoundError,
    BarcodeProviderError,
    InvalidBarcodeError,
    lookup_barcode_product,
)


barcode_blueprint = Blueprint(
    "barcode",
    __name__,
    url_prefix="/api/barcode",
)


@barcode_blueprint.post("/lookup")
def lookup_barcode():
    payload = request.get_json(silent=True) or {}

    try:
        product = lookup_barcode_product(payload.get("barcode"))
        return jsonify(product)
    except InvalidBarcodeError as exc:
        return jsonify({"error": str(exc)}), 400
    except BarcodeNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except BarcodeProviderError as exc:
        return jsonify({"error": str(exc)}), 502
