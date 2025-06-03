from datetime import datetime, timedelta

def find_windows(forecast, min_temp, max_temp, no_rain, duration_hours):
    """
    Given hourly forecast and task constraints, find possible start/end windows.
    - forecast: list of dicts with 'dt' (timestamp), 'temp', 'rain'
    - min_temp, max_temp: floats
    - no_rain: bool
    - duration_hours: int

    Returns a list of {start, end} (ISO strings) where the window is valid.
    """
    valid_slots = []
    hours_needed = duration_hours
    slot = []
    for entry in forecast:
        temp = entry["temp"]
        rain = entry["rain"]
        valid = True
        if temp < min_temp:
            valid = False
        if max_temp is not None and temp > max_temp:
            valid = False
        if no_rain and rain > 0:
            valid = False
        if valid:
            slot.append(entry)
            if len(slot) == hours_needed:
                valid_slots.append({
                    "start": datetime.utcfromtimestamp(slot[0]["dt"]).isoformat() + "Z",
                    "end": datetime.utcfromtimestamp(slot[-1]["dt"]).isoformat() + "Z",
                })
                slot.pop(0)
        else:
            slot = []
    return valid_slots
