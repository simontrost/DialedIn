from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from dialed_in.barcode.service import (
    BarcodeNotFoundError,
    InvalidBarcodeError,
    lookup_barcode_product,
    normalize_barcode,
)


class BarcodeValidationTests(unittest.TestCase):
    def test_accepts_valid_ean_13(self):
        self.assertEqual(normalize_barcode("3017624010701"), "3017624010701")

    def test_removes_spaces_and_hyphens(self):
        self.assertEqual(
            normalize_barcode("3017-6240 10701"),
            "3017624010701",
        )

    def test_rejects_invalid_check_digit(self):
        with self.assertRaises(InvalidBarcodeError):
            normalize_barcode("3017624010702")


class BarcodeLookupTests(unittest.TestCase):
    @patch("dialed_in.barcode.service.requests.get")
    def test_maps_open_food_facts_product(self, get_mock):
        response = Mock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Test Espresso",
                "brands": "Test Roastery",
                "origins": "Brazil, Minas Gerais",
                "labels": "100% Arabica, dark roast",
                "quantity": "1 kg",
                "image_front_url": "https://example.test/coffee.jpg",
            },
        }
        get_mock.return_value = response

        product = lookup_barcode_product("3017624010701")

        self.assertEqual(product["name"], "Test Espresso")
        self.assertEqual(product["roaster"], "Test Roastery")
        self.assertEqual(product["originCountry"], "Brazil")
        self.assertEqual(product["originRegion"], "Minas Gerais")
        self.assertEqual(product["blend"], "100% Arabica")
        self.assertEqual(product["roast"], "dark")

    @patch("dialed_in.barcode.service.requests.get")
    def test_reports_unknown_product(self, get_mock):
        response = Mock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        response.json.return_value = {
            "status": 0,
            "status_verbose": "product not found",
        }
        get_mock.return_value = response

        with self.assertRaises(BarcodeNotFoundError):
            lookup_barcode_product("3017624010701")


if __name__ == "__main__":
    unittest.main()
