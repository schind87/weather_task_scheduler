import requests

OPENWEATHER_API_KEY = "28c994ffe7bf1c4f8975ec9e222e3589"


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


def fetch_hourly_forecast(zip_code: str):
    """Fetch the next five days of hourly weather for a ZIP code."""
    normalized = _normalize_zip(zip_code)
    url = (
        "https://api.openweathermap.org/data/2.5/forecast?"
        f"zip={normalized}&appid={OPENWEATHER_API_KEY}&units=imperial"
    )
    try:
        resp = requests.get(url, timeout=10)
    except requests.RequestException as exc:
        raise ValueError("Unable to reach weather service.") from exc
    data = resp.json()
    if "list" not in data:
        message = data.get("message", "Unknown error from weather API.")
        raise ValueError(f"Weather API error: {message}")
    results = []
    for entry in data["list"]:
        results.append(
            {
                "dt": entry["dt"],
                "temp": entry["main"].get("temp"),
                "rain": entry.get("rain", {}).get("3h", 0),
                "humidity": entry["main"].get("humidity"),
            }
        )
    return results
