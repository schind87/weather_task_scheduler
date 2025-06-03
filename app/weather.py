import requests

OPENWEATHER_API_KEY = "YOUR_OPENWEATHERMAP_API_KEY"

def fetch_hourly_forecast(location):
    """
    Fetches the next 5 days of hourly weather for a location (by city name).
    Returns a list of dicts with dt (timestamp), temp, and rain.
    """
    url = (
        f"https://api.openweathermap.org/data/2.5/forecast?"
        f"q={location}&appid={OPENWEATHER_API_KEY}&units=imperial"
    )
    resp = requests.get(url)
    data = resp.json()
    results = []
    for entry in data["list"]:
        # dt is unix timestamp, main.temp is temp F, rain is optional
        results.append({
            "dt": entry["dt"],
            "temp": entry["main"]["temp"],
            "rain": entry.get("rain", {}).get("3h", 0)  # rain in mm in last 3h
        })
    return results
