import pytest

from app import create_app, db


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}"})
    with app.test_client() as client:
        yield client
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_create_list_update_complete_delete_and_persist(client):
    response = client.post("/api/tasks", json={"title": "Read", "priority": "High", "description": "A little each day"})
    assert response.status_code == 201
    task = response.get_json()
    assert task["completed"] is False
    assert task["priority"] == "High"
    task_id = task["id"]
    assert client.get("/api/tasks").get_json()[0]["title"] == "Read"
    assert client.patch(f"/api/tasks/{task_id}", json={"completed": True}).get_json()["completed"] is True
    assert client.patch(f"/api/tasks/{task_id}", json={"completed": False}).get_json()["completed"] is False
    assert client.get(f"/api/tasks/{task_id}").status_code == 200
    # A new app on the same file sees the committed task.
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": client.application.config["SQLALCHEMY_DATABASE_URI"]})
    with app.test_client() as second_client:
        assert second_client.get("/api/tasks").get_json()[0]["id"] == task_id
    assert client.delete(f"/api/tasks/{task_id}").status_code == 204
    assert client.get("/api/tasks").get_json() == []


@pytest.mark.parametrize("payload", [{}, {"title": "  "}, {"title": "ok", "priority": "Urgent"}, {"title": "ok", "completed": "yes"}, "not an object"])
def test_invalid_input_is_rejected(client, payload):
    assert client.post("/api/tasks", json=payload).status_code == 400


def test_update_validates_fields_and_accepts_due_date(client):
    task = client.post("/api/tasks", json={"title": "Plan"}).get_json()
    response = client.patch(
        f"/api/tasks/{task['id']}",
        json={"title": "Plan the week", "priority": "Low", "due_date": "2026-10-12T09:30"},
    )
    assert response.status_code == 200
    assert response.get_json()["title"] == "Plan the week"
    assert response.get_json()["priority"] == "Low"
    assert response.get_json()["due_date"] == "2026-10-12T09:30:00"
    assert client.patch(f"/api/tasks/{task['id']}", json={"priority": []}).status_code == 400
    assert client.patch(f"/api/tasks/{task['id']}", json={"extra": "field"}).status_code == 400


def test_bad_json_and_missing_ids(client):
    assert client.post("/api/tasks", data="{", content_type="application/json").status_code == 400
    assert client.get("/api/tasks/999").status_code == 404
    assert client.patch("/api/tasks/999", json={"completed": True}).status_code == 404
    assert client.delete("/api/tasks/999").status_code == 404


def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_frontend_and_static_assets_are_served(client):
    assert client.get("/").status_code == 200
    assert b"Daymark" in client.get("/").data
    assert client.get("/static/js/main.js").status_code == 200
    assert client.get("/static/css/style.css").status_code == 200
