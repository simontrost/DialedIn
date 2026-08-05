from __future__ import annotations

import sqlite3
from io import BytesIO
from pathlib import Path

from flask import Flask
from flask.testing import FlaskClient


def _profiles(client: FlaskClient) -> dict:
    response = client.get("/api/profiles")
    assert response.status_code == 200
    return response.get_json()


def _create_profile(
    client: FlaskClient,
    name: str,
    password: str = "guest-password",
    avatar: bytes | None = None,
) -> dict:
    data: dict[str, object] = {
        "name": name,
        "password": password,
        "passwordConfirmation": password,
    }
    if avatar is not None:
        data["avatar"] = (BytesIO(avatar), "avatar.png")
    response = client.post("/api/profiles", data=data, content_type="multipart/form-data")
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def _login(client: FlaskClient, profile_id: str, password: str) -> dict:
    response = client.post(
        f"/api/profiles/{profile_id}/login",
        json={"password": password},
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_existing_database_is_adopted_as_default_profile(
    app: Flask,
    client: FlaskClient,
) -> None:
    payload = _profiles(client)

    assert len(payload["profiles"]) == 1
    assert payload["activeProfile"]["id"] == "default"
    assert payload["activeProfile"]["isDefault"] is True
    assert payload["activeProfile"]["needsPasswordSetup"] is False

    registry_path = Path(app.config["PROFILE_REGISTRY_PATH"])
    with sqlite3.connect(registry_path) as db:
        stored_path, password_hash = db.execute(
            "SELECT database_path, password_hash FROM profiles WHERE id = 'default'"
        ).fetchone()

    stored = Path(stored_path)
    if not stored.is_absolute():
        stored = registry_path.parent / stored
    assert stored.resolve() == Path(app.config["DB_PATH"]).resolve()
    assert password_hash
    assert "test-password" not in password_hash


def test_profiles_keep_independent_coffee_data(
    client: FlaskClient,
    bean_factory,
) -> None:
    default_profile = _profiles(client)["activeProfile"]
    default_bean = bean_factory(name="Default Espresso")

    guest_profile = _create_profile(client, "Guest")

    guest_state = client.get("/api/state").get_json()
    assert guest_state["profile"]["id"] == guest_profile["id"]
    assert guest_state["beans"] == []
    assert guest_state["brewRecipes"] == []
    assert guest_state["dialInLogs"] == []

    guest_bean = bean_factory(name="Guest Espresso")

    _login(client, default_profile["id"], "test-password")
    default_state = client.get("/api/state").get_json()
    assert [bean["id"] for bean in default_state["beans"]] == [default_bean["id"]]
    assert guest_bean["id"] not in {bean["id"] for bean in default_state["beans"]}

    _login(client, guest_profile["id"], "guest-password")
    restored_guest_state = client.get("/api/state").get_json()
    assert [bean["id"] for bean in restored_guest_state["beans"]] == [guest_bean["id"]]


def test_profile_settings_are_independent(client: FlaskClient) -> None:
    default_profile = _profiles(client)["activeProfile"]
    office_profile = _create_profile(client, "Office")

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

    _login(client, default_profile["id"], "test-password")
    default_settings = client.get("/api/state").get_json()["settings"]
    assert default_settings["machine"] != "Office Machine"
    assert default_settings["theme"] == "light"

    _login(client, office_profile["id"], "guest-password")
    office_settings = client.get("/api/state").get_json()["settings"]
    assert office_settings["machine"] == "Office Machine"
    assert office_settings["grinder"] == "Office Grinder"
    assert office_settings["theme"] == "dark"


def test_sign_out_requires_password_login(client: FlaskClient) -> None:
    default_profile = _profiles(client)["activeProfile"]

    response = client.post("/api/profiles/logout")
    assert response.status_code == 204

    state_response = client.get("/api/state")
    assert state_response.status_code == 401
    assert state_response.get_json()["code"] == "profile_required"
    assert _profiles(client)["activeProfile"] is None

    wrong = client.post(
        f"/api/profiles/{default_profile['id']}/login",
        json={"password": "wrong-password"},
    )
    assert wrong.status_code == 401
    assert _profiles(client)["activeProfile"] is None

    _login(client, default_profile["id"], "test-password")
    assert client.get("/api/state").status_code == 200


def test_new_profile_requires_password_and_confirmation(client: FlaskClient) -> None:
    missing = client.post("/api/profiles", json={"name": "No Password"})
    assert missing.status_code == 400
    assert "at least 6" in missing.get_json()["error"]

    mismatch = client.post(
        "/api/profiles",
        json={
            "name": "Mismatch",
            "password": "password-one",
            "passwordConfirmation": "password-two",
        },
    )
    assert mismatch.status_code == 400
    assert "does not match" in mismatch.get_json()["error"]


def test_profile_can_be_renamed_and_password_changed(client: FlaskClient) -> None:
    profile = _create_profile(client, "Old name", "old-password")

    response = client.patch(
        f"/api/profiles/{profile['id']}",
        data={
            "name": "Home Barista",
            "currentPassword": "old-password",
            "newPassword": "new-password",
            "newPasswordConfirmation": "new-password",
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["name"] == "Home Barista"

    client.post("/api/profiles/logout")
    old_login = client.post(
        f"/api/profiles/{profile['id']}/login",
        json={"password": "old-password"},
    )
    assert old_login.status_code == 401
    logged_in = _login(client, profile["id"], "new-password")
    assert logged_in["name"] == "Home Barista"


def test_profile_picture_can_be_uploaded_and_removed(client: FlaskClient) -> None:
    tiny_png = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
        b"\x1f\x15\xc4\x89"
    )
    profile = _create_profile(client, "Picture", avatar=tiny_png)
    assert profile["hasAvatar"] is True
    assert profile["avatarUrl"]

    avatar_response = client.get(f"/api/profiles/{profile['id']}/avatar")
    assert avatar_response.status_code == 200
    assert avatar_response.mimetype == "image/png"
    assert avatar_response.data == tiny_png

    remove_response = client.patch(
        f"/api/profiles/{profile['id']}",
        data={
            "name": "Picture",
            "removeAvatar": "true",
            "newPassword": "",
            "newPasswordConfirmation": "",
        },
        content_type="multipart/form-data",
    )
    assert remove_response.status_code == 200
    assert remove_response.get_json()["hasAvatar"] is False
    assert client.get(f"/api/profiles/{profile['id']}/avatar").status_code == 404


def test_legacy_profile_can_set_password_once(app: Flask, client: FlaskClient) -> None:
    registry_path = Path(app.config["PROFILE_REGISTRY_PATH"])
    with sqlite3.connect(registry_path) as db:
        db.execute("UPDATE profiles SET password_hash = NULL WHERE id = 'default'")
        db.commit()

    client.post("/api/profiles/logout")
    payload = _profiles(client)
    default_profile = next(profile for profile in payload["profiles"] if profile["id"] == "default")
    assert default_profile["needsPasswordSetup"] is True

    response = client.post(
        "/api/profiles/default/setup-password",
        json={
            "password": "migrated-password",
            "passwordConfirmation": "migrated-password",
        },
    )
    assert response.status_code == 200
    assert response.get_json()["needsPasswordSetup"] is False

    second_setup = client.post(
        "/api/profiles/default/setup-password",
        json={
            "password": "another-password",
            "passwordConfirmation": "another-password",
        },
    )
    assert second_setup.status_code == 400


def test_duplicate_profile_names_are_rejected(client: FlaskClient) -> None:
    _create_profile(client, "Home")

    response = client.post(
        "/api/profiles",
        json={
            "name": "home",
            "password": "another-password",
            "passwordConfirmation": "another-password",
        },
    )

    assert response.status_code == 400
    assert "already exists" in response.get_json()["error"]


def test_backup_is_labeled_with_active_profile(client: FlaskClient) -> None:
    _create_profile(client, "Office Setup")

    export_response = client.get("/api/export")

    assert export_response.status_code == 200
    assert export_response.get_json()["profile"]["name"] == "Office Setup"
    disposition = export_response.headers["Content-Disposition"]
    assert "dialed-in-office-setup-backup-" in disposition
