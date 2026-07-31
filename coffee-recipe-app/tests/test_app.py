from __future__ import annotations

from flask.testing import FlaskClient


def test_state_endpoint_uses_clean_test_database(client: FlaskClient) -> None:
    response = client.get("/api/state")

    assert response.status_code == 200
    state = response.get_json()
    assert state["beans"] == []
    assert state["brewRecipes"] == []
    assert state["dialInLogs"] == []
    assert state["brewingMethods"]
    assert state["settings"]["theme"] == "light"
