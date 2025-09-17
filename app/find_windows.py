from collections import Counter
import time
from typing import Dict, List, Optional, Tuple

Block = Dict[str, float]


def format_window(start_ts: int, end_ts: int) -> str:
    """Return a friendly string for a window using local time."""
    start_local = time.localtime(start_ts)
    end_local = time.localtime(end_ts)
    start_month = str(start_local.tm_mon)
    start_day = str(start_local.tm_mday)
    start_hour = start_local.tm_hour % 12 or 12
    start_ampm = 'AM' if start_local.tm_hour < 12 else 'PM'
    end_month = str(end_local.tm_mon)
    end_day = str(end_local.tm_mday)
    end_hour = end_local.tm_hour % 12 or 12
    end_ampm = 'AM' if end_local.tm_hour < 12 else 'PM'
    if (start_local.tm_mon, start_local.tm_mday) != (end_local.tm_mon, end_local.tm_mday):
        return f"{start_month}/{start_day} {start_hour} {start_ampm} - {end_month}/{end_day} {end_hour} {end_ampm}"
    return f"{start_month}/{start_day} {start_hour} {start_ampm} - {end_hour} {end_ampm}"


def _parse_time_string(value: Optional[str]) -> Optional[Tuple[int, int]]:
    if not value:
        return None
    hour_str, minute_str = value.split(':')
    return int(hour_str), int(minute_str)


def _check_constraints(
    entry: Block,
    min_temp: Optional[float],
    max_temp: Optional[float],
    min_humidity: Optional[int],
    max_humidity: Optional[int],
    no_rain: bool,
    earliest: Optional[Tuple[int, int]],
    latest: Optional[Tuple[int, int]],
    enforce_time: bool = True,
) -> Tuple[bool, Optional[str]]:
    temp = entry.get('temp')
    rain = entry.get('rain', 0) or 0
    humidity = entry.get('humidity')
    if temp is None:
        return False, 'temperature missing from forecast'
    if min_temp is not None and temp < min_temp:
        return False, f'temperature below minimum ({temp:.0f}F < {min_temp:.0f}F)'
    if max_temp is not None and temp > max_temp:
        return False, f'temperature above maximum ({temp:.0f}F > {max_temp:.0f}F)'
    if min_humidity is not None:
        if humidity is None:
            return False, 'humidity missing from forecast'
        if humidity < min_humidity:
            return False, f'humidity below minimum ({humidity}% < {min_humidity}%)'
    if max_humidity is not None:
        if humidity is None:
            return False, 'humidity missing from forecast'
        if humidity > max_humidity:
            return False, f'humidity above maximum ({humidity}% > {max_humidity}%)'
    if no_rain and rain > 0:
        return False, 'rain expected during window'
    if enforce_time and (earliest or latest):
        dt_local = time.localtime(entry['dt'])
        current_hour = (dt_local.tm_hour, dt_local.tm_min)
        if earliest and current_hour < earliest:
            return False, f'start before earliest allowed ({dt_local.tm_hour:02d}:{dt_local.tm_min:02d})'
        if latest and current_hour > latest:
            return False, f'start after latest allowed ({dt_local.tm_hour:02d}:{dt_local.tm_min:02d})'
    return True, None


def _summarize_failures(failures: Counter) -> Optional[str]:
    if not failures:
        return None
    most_common = failures.most_common(3)
    formatted = ', '.join(f"{reason} (x{count})" for reason, count in most_common)
    return f"No windows matched all constraints. Common blockers: {formatted}."


def find_windows(
    forecast: List[Block],
    min_temp: Optional[float],
    max_temp: Optional[float],
    min_humidity: Optional[int],
    max_humidity: Optional[int],
    no_rain: bool,
    duration_hours: int,
    earliest_start: Optional[str] = None,
    latest_start: Optional[str] = None,
) -> Dict[str, object]:
    """Given hourly forecast and task constraints, find viable time windows."""
    if not forecast:
        return {'windows': [], 'reason_summary': 'No forecast data was returned for this ZIP code.', 'reason_details': []}
    if duration_hours <= 0:
        return {'windows': [], 'reason_summary': 'Duration must be greater than zero.', 'reason_details': []}
    earliest = _parse_time_string(earliest_start)
    latest = _parse_time_string(latest_start)
    valid_windows: List[Dict[str, str]] = []
    block_hours = 3
    failures: Counter[str] = Counter()
    max_available = block_hours * len(forecast)
    if duration_hours > max_available:
        summary = 'Forecast horizon is shorter than the required task duration.'
        return {'windows': [], 'reason_summary': summary, 'reason_details': []}
    i = 0
    n = len(forecast)
    while i < n:
        start_idx = i
        total_hours = 0
        j = i
        window_start = forecast[start_idx]['dt']
        last_dt = window_start
        window_failed = False
        window_emitted = False
        while j < n:
            block = forecast[j]
            if j > start_idx and block['dt'] - last_dt != block_hours * 3600:
                failures['forecast data gaps prevent continuous window'] += 1
                window_failed = True
                break
            enforce_time = j == start_idx
            block_valid, block_reason = _check_constraints(
                block,
                min_temp,
                max_temp,
                min_humidity,
                max_humidity,
                no_rain,
                earliest if enforce_time else None,
                latest if enforce_time else None,
                enforce_time=enforce_time,
            )
            if not block_valid:
                if block_reason:
                    failures[block_reason] += 1
                window_failed = True
                break
            total_hours += block_hours
            last_dt = block['dt']
            j += 1
            if total_hours >= duration_hours:
                window_emitted = True
                break
        if not window_emitted and total_hours < duration_hours and j >= n:
            failures['forecast horizon ended before reaching required duration'] += 1
        if (window_emitted or (not window_failed and total_hours >= duration_hours)) and not window_failed:
            window_end = last_dt + block_hours * 3600
            actual_hours = int((window_end - window_start) / 3600)
            valid_windows.append(
                {
                    'display': format_window(window_start, window_end),
                    'start_ts': window_start,
                    'duration': f"{actual_hours}h",
                }
            )
        i = j if j > i else i + 1
    if valid_windows:
        reason_summary = None
    else:
        reason_summary = _summarize_failures(failures)
        if not reason_summary:
            reason_summary = 'No windows matched all constraints.'
    reason_details = [{'reason': reason, 'count': count} for reason, count in failures.most_common()] if failures else []
    return {'windows': valid_windows, 'reason_summary': reason_summary, 'reason_details': reason_details}
