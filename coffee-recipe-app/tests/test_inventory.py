from __future__ import annotations

from collections.abc import Callable
from typing import Any

from flask.testing import FlaskClient


def measurement_payload(bean: dict[str, Any], recipe: dict[str, Any], *, dose: float) -> dict[str, Any]:
    return {
        "beanId": bean["id"],
        "brewRecipeId": recipe["id"],
        "grind": 18,
        "dose": dose,
        "beverageYield": 36,
        "time": 28,
        "taste": "balanced",
    }


def get_bean(client: FlaskClient, bean_id: str) -> dict[str, Any]:
    beans = client.get("/api/beans").get_json()
    return next(bean for bean in beans if bean["id"] == bean_id)


def test_bean_stock_can_be_created_and_manually_adjusted(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(bagSizeGrams=250, remainingGrams=173.5)

    assert bean["bagSizeGrams"] == 250
    assert bean["remainingGrams"] == 173.5

    response = client.put(
        f"/api/beans/{bean['id']}",
        json={**bean, "remainingGrams": 120},
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json()["remainingGrams"] == 120


def test_new_measurement_reduces_tracked_stock(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(bagSizeGrams=250, remainingGrams=250)
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in-logs",
        json=measurement_payload(bean, recipe, dose=18),
    )

    assert response.status_code == 201, response.get_json()
    assert get_bean(client, bean["id"])["remainingGrams"] == 232


def test_editing_and_deleting_measurement_reconciles_stock(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(bagSizeGrams=250, remainingGrams=250)
    recipe = recipe_factory(bean["id"])
    created = client.post(
        "/api/dial-in-logs",
        json=measurement_payload(bean, recipe, dose=18),
    ).get_json()

    updated = client.put(
        f"/api/dial-in-logs/{created['id']}",
        json=measurement_payload(bean, recipe, dose=20),
    )
    assert updated.status_code == 200, updated.get_json()
    assert get_bean(client, bean["id"])["remainingGrams"] == 230

    deleted = client.delete(f"/api/dial-in-logs/{created['id']}")
    assert deleted.status_code == 204
    assert get_bean(client, bean["id"])["remainingGrams"] == 250


def test_stock_never_becomes_negative(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(bagSizeGrams=250, remainingGrams=10)
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in-logs",
        json=measurement_payload(bean, recipe, dose=18),
    )

    assert response.status_code == 201, response.get_json()
    assert get_bean(client, bean["id"])["remainingGrams"] == 0


def test_untracked_bean_measurements_remain_supported(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory()
    recipe = recipe_factory(bean["id"])

    response = client.post(
        "/api/dial-in-logs",
        json=measurement_payload(bean, recipe, dose=18),
    )

    assert response.status_code == 201, response.get_json()
    stored = get_bean(client, bean["id"])
    assert stored["bagSizeGrams"] is None
    assert stored["remainingGrams"] is None

def test_tracked_stock_controls_status_automatically(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(
        bagSizeGrams=250,
        remainingGrams=100,
        status="wishlist",
    )
    assert bean["status"] == "active"

    emptied = client.put(
        f"/api/beans/{bean['id']}",
        json={**bean, "remainingGrams": 0, "status": "active"},
    )
    assert emptied.status_code == 200, emptied.get_json()
    assert emptied.get_json()["status"] == "empty"

    refilled = client.put(
        f"/api/beans/{bean['id']}",
        json={**emptied.get_json(), "remainingGrams": 250, "status": "empty"},
    )
    assert refilled.status_code == 200, refilled.get_json()
    assert refilled.get_json()["status"] == "active"


def test_measurement_emptying_and_restoring_stock_updates_status(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
    recipe_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(bagSizeGrams=250, remainingGrams=18)
    recipe = recipe_factory(bean["id"])

    created = client.post(
        "/api/dial-in-logs",
        json=measurement_payload(bean, recipe, dose=18),
    )
    assert created.status_code == 201, created.get_json()
    empty_bean = get_bean(client, bean["id"])
    assert empty_bean["remainingGrams"] == 0
    assert empty_bean["status"] == "empty"

    deleted = client.delete(f"/api/dial-in-logs/{created.get_json()['id']}")
    assert deleted.status_code == 204
    restored_bean = get_bean(client, bean["id"])
    assert restored_bean["remainingGrams"] == 18
    assert restored_bean["status"] == "active"


def test_untracked_bean_status_remains_manual(
    client: FlaskClient,
    bean_factory: Callable[..., dict[str, Any]],
) -> None:
    bean = bean_factory(status="wishlist")
    assert bean["bagSizeGrams"] is None
    assert bean["status"] == "wishlist"

