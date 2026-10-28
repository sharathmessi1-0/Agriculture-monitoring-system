from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def create_field(client):
    return client.post(
        "/api/fields",
        json={"name": "Field A", "area_hectares": 2.5, "soil_type": "loam"},
    ).json()


def test_health_and_cors(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_field_creation_validation_and_conflict(client):
    created = client.post("/api/fields", json={"name": "Plot", "area_hectares": 1})
    assert created.status_code == 201
    assert created.json()["is_demo"] is False
    assert client.post("/api/fields", json={"name": "Plot", "area_hectares": 2}).status_code == 409
    assert client.post("/api/fields", json={"name": "Bad", "area_hectares": 0}).status_code == 422


def test_reading_generates_and_resolves_alert(client):
    field = create_field(client)
    payload = {
        "field_id": field["id"],
        "soil_moisture": 10,
        "temperature_c": 25,
        "humidity_percent": 50,
        "soil_ph": 6.5,
        "rainfall_mm": 0,
    }
    assert client.post("/api/readings", json=payload).status_code == 201
    alerts = client.get("/api/alerts", params={"status": "active"}).json()
    assert len(alerts) == 1
    assert alerts[0]["alert_type"] == "low_moisture"
    payload["soil_moisture"] = 35
    client.post("/api/readings", json=payload)
    assert client.get("/api/alerts", params={"status": "active"}).json() == []
    assert client.get("/api/alerts", params={"status": "resolved"}).json()[0]["status"] == "resolved"


def test_recommendations_and_filtered_report(client):
    field = create_field(client)
    client.post(
        "/api/readings",
        json={
            "field_id": field["id"],
            "soil_moisture": 35,
            "temperature_c": 26,
            "humidity_percent": 60,
            "soil_ph": 6.5,
            "nitrogen": 80,
            "phosphorus": 40,
            "potassium": 40,
            "rainfall_mm": 100,
        },
    )
    crop = client.post(
        "/api/recommendations/crop",
        json={
            "nitrogen": 80,
            "phosphorus": 40,
            "potassium": 40,
            "temperature_c": 26,
            "humidity_percent": 60,
            "soil_ph": 6.5,
            "soil_type": "Loamy",
            "rainfall_mm": 100,
        },
    )
    assert crop.status_code == 200
    assert crop.json()["method"] in {"trained_educational_model", "educational_fallback"}
    assert "Educational" in crop.json()["disclaimer"]
    irrigation = client.get(f"/api/recommendations/irrigation/{field['id']}")
    assert irrigation.status_code == 200
    report = client.get("/api/reports/summary", params={"field_id": field["id"], "include_demo": False})
    assert report.status_code == 200
    assert report.json()["reading_count"] == 1
    assert report.json()["average_soil_moisture"] == 35


def test_missing_entities_and_bad_report_range(client):
    assert client.get("/api/fields/123").status_code == 404
    assert client.get("/api/recommendations/irrigation/123").status_code == 404
    assert client.get(
        "/api/reports/summary",
        params={"start": "2025-02-01T00:00:00", "end": "2025-01-01T00:00:00"},
    ).status_code == 422


def test_requested_dashboard_crud_and_report_endpoints(client):
    assert client.get("/api/dashboard").status_code == 200
    created = client.post(
        "/api/fields",
        json={
            "name": "Alias Field",
            "area": 1.5,
            "location": "Test",
            "crop_type": "Maize",
            "soil_type": "Sandy",
        },
    )
    assert created.status_code == 201
    field = created.json()
    assert field["area_hectares"] == 1.5

    updated = client.put(
        f"/api/fields/{field['id']}",
        json={"location": "Updated test location"},
    )
    assert updated.status_code == 200
    assert updated.json()["location"] == "Updated test location"

    reading = client.post(
        "/api/readings",
        json={
            "field_id": field["id"],
            "soil_moisture": 15,
            "temperature": 28,
            "humidity": 60,
            "soil_ph": 6.5,
            "rainfall": 5,
        },
    )
    assert reading.status_code == 201
    assert reading.json()["temperature_c"] == 28

    report = client.get(
        "/api/reports/readings",
        params={"field_id": field["id"], "include_demo": False},
    )
    assert report.status_code == 200
    assert len(report.json()) == 1
    assert report.json()[0]["field_name"] == "Alias Field"

    alert = client.get("/api/alerts", params={"status": "active"}).json()[0]
    resolved = client.patch(f"/api/alerts/{alert['id']}/resolve")
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_crop_and_threshold_irrigation_endpoints(client):
    field = create_field(client)
    client.post(
        "/api/readings",
        json={
            "field_id": field["id"],
            "soil_moisture": 18,
            "temperature_c": 26,
            "humidity_percent": 60,
            "soil_ph": 6.5,
            "rainfall_mm": 4,
        },
    )
    crop = client.post(
        "/api/recommendations/crops",
        json={
            "nitrogen": 80,
            "phosphorus": 40,
            "potassium": 40,
            "temperature": 25,
            "humidity": 70,
            "soil_ph": 6.5,
            "rainfall": 100,
            "soil_type": "Loamy",
        },
    )
    assert crop.status_code == 200
    assert crop.json()["recommended_crop"]
    assert crop.json()["alternatives"]
    assert crop.json()["reasons"]

    below_threshold = client.post(
        "/api/recommendations/irrigation",
        json={"field_id": field["id"], "moisture_threshold": 30},
    )
    above_threshold = client.post(
        "/api/recommendations/irrigation",
        json={"field_id": field["id"], "moisture_threshold": 10},
    )
    assert "Check irrigation needs" in below_threshold.json()["recommendation"]
    assert "may not be necessary" in above_threshold.json()["recommendation"]


def test_missing_and_outdated_reading_alerts(client):
    field = create_field(client)
    missing = client.get("/api/alerts", params={"field_id": field["id"]}).json()
    assert missing[0]["alert_type"] == "missing_reading"
    assert missing[0]["suggested_action"] == "Record an observation for this field."

    client.post(
        "/api/readings",
        json={
            "field_id": field["id"],
            "soil_moisture": 45,
            "temperature_c": 24,
            "humidity_percent": 60,
            "soil_ph": 6.5,
            "rainfall_mm": 0,
            "recorded_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        },
    )
    outdated = client.get(
        "/api/alerts",
        params={"field_id": field["id"], "status": "active"},
    ).json()
    assert any(alert["alert_type"] == "outdated_reading" for alert in outdated)
