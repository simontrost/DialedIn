from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from dialed_in import create_app
from dialed_in.database import db_connection


@pytest.fixture()
def app(tmp_path: Path) -> Flask:
    """Create an isolated DialedIn application for every test."""

    application = create_app(
        {
            "TESTING": True,
            "DB_PATH": tmp_path / "coffee-test.db",
        }
    )

    # A completely new DialedIn database contains an example bean and recipe.
    # Tests should start with empty user data, while keeping default settings.
    with application.app_context():
        with db_connection() as db:
            db.execute("DELETE FROM dial_in_logs")
            db.execute("DELETE FROM brew_recipes")
            db.execute("DELETE FROM beans")
            db.execute("DELETE FROM recipes")

    yield application


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    test_client = app.test_client()
    profiles = test_client.get("/api/profiles").get_json()["profiles"]
    default_profile = next(profile for profile in profiles if profile["isDefault"])
    response = test_client.post(
        f"/api/profiles/{default_profile['id']}/setup-password",
        json={
            "password": "test-password",
            "passwordConfirmation": "test-password",
        },
    )
    assert response.status_code == 200
    return test_client


@pytest.fixture()
def bean_factory(client: FlaskClient) -> Callable[..., dict[str, Any]]:
    def create_bean(**overrides: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": "Test Espresso",
            "roaster": "Test Roastery",
            "roast": "medium",
            "status": "active",
            "strength": 4,
            "tasteBalance": "balanced",
            "flavorNotes": ["Chocolate", "Caramel"],
            "isGround": False,
        }
        payload.update(overrides)

        response = client.post("/api/beans", json=payload)
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    return create_bean


@pytest.fixture()
def recipe_factory(client: FlaskClient) -> Callable[..., dict[str, Any]]:
    def create_recipe(
        bean_id: str,
        *,
        method: str = "espresso",
        values: dict[str, Any] | None = None,
        **overrides: Any,
    ) -> dict[str, Any]:
        recipe_values: dict[str, Any] = {
            "dose": 18,
            "beverageYield": 36,
            "targetTime": 28,
            "grind": 17.5,
            "temperature": 93,
            "pressure": 9,
            "preInfusionEnabled": False,
        }
        if values:
            recipe_values.update(values)

        payload: dict[str, Any] = {
            "beanId": bean_id,
            "name": "Test Recipe",
            "method": method,
            "values": recipe_values,
            "steps": [],
            "notes": "Created by an automated test.",
        }
        payload.update(overrides)

        response = client.post("/api/brew-recipes", json=payload)
        assert response.status_code == 201, response.get_json()
        return response.get_json()

    return create_recipe
