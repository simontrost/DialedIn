from __future__ import annotations

from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def test_whole_bean_recipe_keeps_grind(
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=False)
    recipe = recipe_factory(bean["id"], values={"grind": 18.5})

    assert recipe["values"]["grind"] == 18.5


def test_ground_bean_recipe_removes_grind(
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=True)
    recipe = recipe_factory(bean["id"], values={"grind": 18.5})

    assert "grind" not in recipe["values"]


def test_changing_bean_to_ground_removes_existing_recipe_grind(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(isGround=False)
    recipe_factory(bean["id"], values={"grind": 19})

    update_response = client.put(
        f"/api/beans/{bean['id']}",
        json={
            **bean,
            "isGround": True,
        },
    )
    assert update_response.status_code == 200, update_response.get_json()

    recipes_response = client.get(f"/api/brew-recipes?beanId={bean['id']}")
    assert recipes_response.status_code == 200
    recipes = recipes_response.get_json()

    assert len(recipes) == 1
    assert "grind" not in recipes[0]["values"]


def test_enabled_preinfusion_is_stored(
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory()
    recipe = recipe_factory(
        bean["id"],
        values={
            "preInfusionEnabled": True,
            "preInfusionTime": 7.5,
            "preInfusionPressure": 2.5,
        },
    )

    assert recipe["values"]["preInfusionEnabled"] is True
    assert recipe["values"]["preInfusionTime"] == 7.5
    assert recipe["values"]["preInfusionPressure"] == 2.5


def test_recipe_rejects_missing_bean(client: FlaskClient) -> None:
    response = client.post(
        "/api/brew-recipes",
        json={
            "beanId": "does-not-exist",
            "name": "Invalid Recipe",
            "method": "espresso",
            "values": {
                "dose": 18,
                "beverageYield": 36,
                "targetTime": 28,
            },
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Selected bean does not exist."
