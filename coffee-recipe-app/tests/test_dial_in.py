from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from flask.testing import FlaskClient


def test_whole_bean_measurement_requires_grind(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=False)
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in-logs",
        json={
            "beanId": bean["id"],
            "brewRecipeId": recipe["id"],
            "time": 28,
            "taste": "balanced",
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "grind is required for whole-bean coffee."


def test_ground_bean_measurement_accepts_missing_grind(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=True)
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in-logs",
        json={
            "beanId": bean["id"],
            "brewRecipeId": recipe["id"],
            "time": 29,
            "taste": "balanced",
            "rating": 4.5,
            "valid": False,
        },
    )

    assert response.status_code == 201, response.get_json()
    measurement = response.get_json()
    assert measurement["grind"] is None
    assert measurement["valid"] is True
    assert measurement["rating"] == 4.5


def test_ground_bean_has_no_grind_recommendation(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=True)
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in/recommendation",
        json={"recipeId": recipe["id"]},
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == (
        "Grind recommendations are disabled for pre-ground coffee."
    )


def test_recommendation_respects_maximum_next_change(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=False)
    recipe = recipe_factory(bean["id"], values={"grind": 20, "targetTime": 28})

    measurement = client.post(
        "/api/dial-in-logs",
        json={
            "beanId": bean["id"],
            "brewRecipeId": recipe["id"],
            "grind": 20,
            "time": 20,
            "taste": "neutral",
        },
    )
    assert measurement.status_code == 201, measurement.get_json()

    response = client.post(
        "/api/dial-in/recommendation",
        json={"recipeId": recipe["id"], "maxStep": 1},
    )

    assert response.status_code == 200, response.get_json()
    recommendation = response.get_json()
    assert recommendation["mode"] == "single_measurement"
    assert recommendation["currentGrind"] == 20
    assert recommendation["change"] == pytest.approx(-1.0)
    assert recommendation["recommendedGrind"] == pytest.approx(19.0)
