import os
import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Ensure the API key is available before importing application modules that
# validate it during import time.
os.environ.setdefault("OPENWEATHER_API_KEY", "testing-key")

from app import models
from app.main import app, engine, SessionLocal
from app import crud


client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_database():
    """Reset the on-disk SQLite database around each test case."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    yield
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)


def _install_weather_mock(monkeypatch, forecast_blocks, timezone_offset):
    def _fake_fetch(zip_code: str):
        return forecast_blocks, timezone_offset

    monkeypatch.setattr(crud.weather, "fetch_hourly_forecast", _fake_fetch)
    # The FastAPI routes import the weather module directly as well.
    from app import main as main_module

    monkeypatch.setattr(main_module.weather, "fetch_hourly_forecast", _fake_fetch)


def test_create_task_returns_window_using_weather_timezone(monkeypatch):
    base_ts = 1_693_526_400  # 2023-09-01 00:00:00 UTC
    forecast = [
        {"dt": base_ts, "temp": 70.0, "rain": 0.0, "humidity": 40},
        {"dt": base_ts + 10_800, "temp": 72.0, "rain": 0.0, "humidity": 42},
    ]
    _install_weather_mock(monkeypatch, forecast, timezone_offset=7_200)

    payload = {
        "name": "Morning gardening",
        "duration_hours": 3,
        "min_temp": None,
        "max_temp": None,
        "min_humidity": None,
        "max_humidity": None,
        "no_rain": True,
        "location": "12345",
        "earliest_start": "04:00",
        "latest_start": None,
    }

    response = client.post("/tasks/", json=payload)
    assert response.status_code == 200
    body = response.json()

    windows = body["possible_windows"]
    assert len(windows) == 1
    first_window = windows[0]
    assert first_window["start_ts"] == forecast[1]["dt"]
    assert first_window["display"] == "9/1 5 AM - 8 AM"
    assert body["reason_summary"] is None
    assert {"reason": "start before earliest allowed (02:00)", "count": 1} in body["reason_details"]

    scheduled_time = datetime.fromisoformat(body["task"]["scheduled_time"])
    assert scheduled_time == datetime.utcfromtimestamp(forecast[1]["dt"])


def test_suggestions_endpoint_respects_timezone(monkeypatch):
    base_ts = 1_693_526_400  # 2023-09-01 00:00:00 UTC
    forecast = [
        {"dt": base_ts, "temp": 68.0, "rain": 0.0, "humidity": 45},
        {"dt": base_ts + 10_800, "temp": 70.0, "rain": 0.0, "humidity": 43},
    ]
    _install_weather_mock(monkeypatch, forecast, timezone_offset=-3_600)

    with SessionLocal() as session:
        task = models.Task(
            name="Overnight maintenance",
            duration_hours=3,
            min_temp=None,
            max_temp=None,
            min_humidity=None,
            max_humidity=None,
            no_rain=True,
            location="94107",
            created_at=datetime.utcnow(),
            scheduled_time=None,
            earliest_start="23:00",
            latest_start=None,
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        task_id = task.id

    response = client.post("/suggestions/", json={"task_id": task_id})
    assert response.status_code == 200
    body = response.json()

    windows = body["possible_windows"]
    assert len(windows) == 1
    first_window = windows[0]
    assert first_window["start_ts"] == forecast[0]["dt"]
    assert first_window["display"] == "8/31 11 PM - 9/1 2 AM"
    assert body["reason_summary"] is None
    assert {"reason": "start before earliest allowed (02:00)", "count": 1} in body["reason_details"]
