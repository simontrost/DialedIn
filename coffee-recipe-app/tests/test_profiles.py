from __future__ import annotations

import sqlite3
from pathlib import Path

from flask import Flask
from flask.testing import FlaskClient


def _profiles(client: FlaskClient) -> dict:
    response = client.get("/api/profiles")
    assert response.status_code == 200
    return response.get_json()


def test_existing_database_is_adopted_as_default_profile(
    app: Flask,
    client: FlaskClient,
) -> None:
    payload = _profiles(client)

    assert len(payload["profiles"]) == 1
    assert payload["activeProfile"]["id"] == "default"
    assert payload["activeProfile"]["isDefault"] is True

    registry_path = Path(app.config["PROFILE_REGISTRY_PATH"])
    with sqlite3.connect(registry_path) as db:
        stored_path = db.execute(
            "SELECT database_path FROM profiles WHERE id = 'default'"
        ).fetchone()[0]

    stored = Path(stored_path)
    if not stored.is_absolute():
        stored = registry_path.parent / stored
    assert stored.resolve() == Path(app.config["DB_PATH"]).resolve()


def test_profiles_keep_independent_coffee_data(
    client: FlaskClient,
    bean_factory,
) -> None:
    default_profile = _profiles(client)["activeProfile"]
    default_bean = bean_factory(name="Default Espresso")

    response = client.post("/api/profiles", json={"name": "Guest"})
    assert response.status_code == 201
    guest_profile = response.get_json()

    guest_state = client.get("/api/state").get_json()
    assert guest_state["profile"]["id"] == guest_profile["id"]
    assert guest_state["beans"] == []
    assert guest_state["brewRecipes"] == []
    assert guest_state["dialInLogs"] == []

    guest_bean = bean_factory(name="Guest Espresso")

    response = client.post(f"/api/profiles/{default_profile['id']}/activate")
    assert response.status_code == 200
    default_state = client.get("/api/state").get_json()
    assert [bean["id"] for bean in default_state["beans"]] == [default_bean["id"]]
    assert guest_bean["id"] not in {bean["id"] for bean in default_state["beans"]}

    response = client.post(f"/api/profiles/{guest_profile['id']}/activate")
    assert response.status_code == 200
    restored_guest_state = client.get("/api/state").get_json()
    assert [bean["id"] for bean in restored_guest_state["beans"]] == [guest_bean["id"]]


def test_profile_settings_are_independent(client: FlaskClient) -> None:
    default_profile = _profiles(client)["activeProfile"]

    response = client.post("/api/profiles", json={"name": "Office"})
    assert response.status_code == 201
    office_profile = response.get_json()

    response = client.put(
        "/api/settings",
        json={
            "machine": "Office Machine",
            "grinder": "Office Grinder",
            "theme": "dark",
            "grindMin": 5,
            "grindMax": 80,
            "machineTemperatureControl": True,
            "machinePressureControl": False,
            "machineFlowControl": False,
        },
    )
    assert response.status_code == 200

    client.post(f"/api/profiles/{default_profile['id']}/activate")
    default_settings = client.get("/api/state").get_json()["settings"]
    assert default_settings["machine"] != "Office Machine"
    assert default_settings["theme"] == "light"

    client.post(f"/api/profiles/{office_profile['id']}/activate")
    office_settings = client.get("/api/state").get_json()["settings"]
    assert office_settings["machine"] == "Office Machine"
    assert office_settings["grinder"] == "Office Grinder"
    assert office_settings["theme"] == "dark"


def test_sign_out_requires_profile_selection(client: FlaskClient) -> None:
    default_profile = _profiles(client)["activeProfile"]

    response = client.post("/api/profiles/logout")
    assert response.status_code == 204

    state_response = client.get("/api/state")
    assert state_response.status_code == 401
    assert state_response.get_json()["code"] == "profile_required"
    assert _profiles(client)["activeProfile"] is None

    response = client.post(f"/api/profiles/{default_profile['id']}/activate")
    assert response.status_code == 200
    assert client.get("/api/state").status_code == 200


def test_duplicate_profile_names_are_rejected(client: FlaskClient) -> None:
    assert client.post("/api/profiles", json={"name": "Home"}).status_code == 201

    response = client.post("/api/profiles", json={"name": "home"})

    assert response.status_code == 400
    assert "already exists" in response.get_json()["error"]


def test_backup_is_labeled_with_active_profile(client: FlaskClient) -> None:
    response = client.post("/api/profiles", json={"name": "Office Setup"})
    assert response.status_code == 201

    export_response = client.get("/api/export")

    assert export_response.status_code == 200
    assert export_response.get_json()["profile"]["name"] == "Office Setup"
    disposition = export_response.headers["Content-Disposition"]
    assert "dialed-in-office-setup-backup-" in disposition
