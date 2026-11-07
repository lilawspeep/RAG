import os

os.environ["DATABASE_URL"] = "sqlite:////tmp/aq-auth-test.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_EMAIL"] = "admin@alquds.local"
os.environ["ADMIN_PASSWORD"] = "Admin12345"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
client.__enter__()


def test_admin_seed_login_and_student_cannot_be_admin():
    bad = client.post("/auth/login", json={"identifier": "admin", "password": "wrong"})
    assert bad.status_code == 401
    ok = client.post("/auth/login", json={"identifier": "admin@alquds.local", "password": "Admin12345"})
    assert ok.status_code == 200
    assert ok.json()["user"]["role"] == "admin"

    reg = client.post(
        "/auth/register",
        json={"full_name": "طالب تجريبي", "email": "s@example.com", "password": "student12", "university_id": "12345678", "faculty": "الهندسة", "major": "حاسوب"},
    )
    assert reg.status_code == 201
    assert reg.json()["user"]["role"] == "student"
    token = reg.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["university_id"] == "12345678"
    assert client.post("/auth/login", json={"identifier": "12345678", "password": "student12"}).status_code == 200


def test_public_registration_cannot_create_admin():
    res = client.post("/auth/register", json={"full_name": "Hacker", "email": "h@example.com", "password": "hackpass1", "role": "admin"})
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "student"
