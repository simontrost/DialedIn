from __future__ import annotations

import pytest

from dialed_in.beans.validation import validate_bean
from dialed_in.brew_recipes.validation import validate_brew_recipe
from dialed_in.dial_in.validation import validate_log


def test_bean_name_is_required() -> None:
    with pytest.raises(ValueError, match="Coffee / bean name is required"):
        validate_bean({"name": ""})


def test_bean_normalizes_aliases_and_flavor_notes() -> None:
    bean = validate_bean(
        {
            "name": "Kivu Espresso",
            "originCountry": "DR Congo",
            "flavorNotes": ["Chocolate", " chocolate ", "Caramel", ""],
            "strength": 4.5,
            "scaScore": "84.37",
        }
    )

    assert bean["originCountry"] == "Democratic Republic of the Congo"
    assert bean["flavorNotes"] == ["Chocolate", "Caramel"]
    assert bean["strength"] == 4.5
    assert bean["scaScore"] == 84.4


def test_bean_rejects_invalid_half_step_strength() -> None:
    with pytest.raises(ValueError, match="half-step increments"):
        validate_bean({"name": "Test", "strength": 4.25})


def test_bean_rejects_sca_score_above_100() -> None:
    with pytest.raises(ValueError, match="between 0 and 100"):
        validate_bean({"name": "Test", "scaScore": 101})


def test_preinfusion_fields_are_hidden_when_disabled() -> None:
    recipe = validate_brew_recipe(
        {
            "beanId": "bean-id",
            "method": "espresso",
            "values": {
                "dose": 18,
                "beverageYield": 36,
                "targetTime": 28,
                "preInfusionEnabled": False,
                "preInfusionTime": 10,
                "preInfusionPressure": 3,
            },
        }
    )

    assert recipe["values"]["preInfusionEnabled"] is False
    assert recipe["values"]["preInfusionTime"] is None
    assert recipe["values"]["preInfusionPressure"] is None


def test_log_rejects_unknown_taste() -> None:
    with pytest.raises(ValueError, match="Invalid taste value"):
        validate_log(
            {
                "beanId": "bean-id",
                "brewRecipeId": "recipe-id",
                "time": 28,
                "taste": "salty",
            }
        )


def test_bean_rejects_remaining_stock_above_bag_size() -> None:
    with pytest.raises(ValueError, match="cannot exceed the bag size"):
        validate_bean({
            "name": "Test",
            "bagSizeGrams": 250,
            "remainingGrams": 300,
        })


def test_bean_defaults_remaining_stock_to_full_bag() -> None:
    bean = validate_bean({"name": "Test", "bagSizeGrams": 500})

    assert bean["bagSizeGrams"] == 500
    assert bean["remainingGrams"] == 500
