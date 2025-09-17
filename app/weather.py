
import os
from typing import Dict, List, Tuple


import requests


class WeatherServiceError(Exception):
    """Raised when the weather service cannot return a valid forecast."""

    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _load_api_key() -> str:
    key = os.environ.get("OPENWEATHER_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "OPENWEATHER_API_KEY environment variable must be set to contact OpenWeather."
        )
    return key


OPENWEATHER_API_KEY = _load_api_key()


def _normalize_zip(zip_code: str) -> str:
    """Normalize user-provided ZIP input for the OpenWeather request."""
    if not zip_code:
        raise ValueError("ZIP code is required.")
    cleaned = zip_code.strip()
    if not cleaned:
        raise ValueError("ZIP code is required.")
    country = "US"
    if "," in cleaned:
        base, remainder = cleaned.split(",", 1)
        cleaned = base.strip()
        remainder = remainder.strip()
        if remainder:
            country = remainder.upper()
    digits = ''.join(ch for ch in cleaned if ch.isdigit())
    if len(digits) not in (5, 9):
        raise ValueError("ZIP code must include 5 or 9 digits.")
    return f"{digits},{country}"


def fetch_hourly_forecast(zip_code: str) -> Tuple[List[Dict[str, float]], int]:
    """Fetch the next five days of hourly weather for a ZIP code.

    Returns a tuple of ``(hourly blocks, location timezone offset)`` where the
    timezone offset is expressed in seconds from UTC.
    """
    normalized = _normalize_zip(zip_code)
    url = (
        "https://api.openweathermap.org/data/2.5/forecast?"
        f"zip={normalized}&appid={OPENWEATHER_API_KEY}&units=imperial"
    )
    try:
        resp = requests.get(url, timeout=10)
    except requests.RequestException as exc:

        raise WeatherServiceError(
            "Unable to reach weather service.", status_code=503
        ) from exc

    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise _build_api_error(resp, zip_code) from exc

    data = _parse_response_json(resp)
    if not isinstance(data, dict) or "list" not in data:
        message = "Unknown error from weather API."
        if isinstance(data, dict):
            extra = data.get("message")
            if isinstance(extra, str) and extra:
                message = extra
        raise WeatherServiceError(
            f"Weather API error: {message}", status_code=502
        )
    results: List[Dict[str, float]] = []
    for entry in data["list"]:
        results.append(
            {
                "dt": entry["dt"],
                "temp": entry["main"].get("temp"),
                "rain": entry.get("rain", {}).get("3h", 0),
                "humidity": entry["main"].get("humidity"),
            }
        )

    timezone_offset = 0
    city = data.get("city") if isinstance(data, dict) else None
    if isinstance(city, dict):
        offset = city.get("timezone")
        if isinstance(offset, (int, float)):
            timezone_offset = int(offset)

    return results, timezone_offset


def _parse_response_json(response: requests.Response):
    try:
        return response.json()
    except ValueError as exc:
        raise WeatherServiceError(
            "Weather service returned invalid JSON.", status_code=502
        ) from exc


def _build_api_error(response: requests.Response, original_zip: str) -> WeatherServiceError:
    status = response.status_code
    payload = None
    payload_message = None
    try:
        payload = response.json()
    except ValueError:
        payload = None
    else:
        if isinstance(payload, dict):
            message = payload.get("message")
            if isinstance(message, str):
                message = message.strip()
                if message:
                    payload_message = _truncate_detail(message)

    text_detail = None
    if not payload_message:
        text = response.text.strip()
        if text:
            text_detail = _truncate_detail(text)

    base_message, status_code = _friendly_status_message(status, original_zip)
    extra_detail = payload_message or text_detail
    if extra_detail and extra_detail not in base_message:
        detail = f"{base_message} Details: {extra_detail}"
    else:
        detail = base_message
    return WeatherServiceError(detail, status_code=status_code)


def _friendly_status_message(status: int, original_zip: str) -> tuple[str, int]:
    if status == 401:
        return (
            "Authentication with OpenWeather failed. Verify the OPENWEATHER_API_KEY credential.",
            500,
        )
    if status == 404:
        return (
            f"No forecast data found for ZIP code '{original_zip}'. Please confirm the location.",
            400,
        )
    if status == 429:
        return (
            "OpenWeather request limit exceeded. Please wait before retrying.",
            429,
        )
    return (f"OpenWeather API request failed with status {status}.", 502)


def _truncate_detail(detail: str, max_length: int = 200) -> str:
    detail = detail.strip()
    if len(detail) > max_length:
        return detail[: max_length - 3] + "..."
    return detail
