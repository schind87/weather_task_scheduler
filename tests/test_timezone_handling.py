import unittest

from app import find_windows


def _forecast_block(ts: int) -> dict:
    return {
        "dt": ts,
        "temp": 70.0,
        "rain": 0,
        "humidity": 50,
    }


class FindWindowsTimezoneTests(unittest.TestCase):
    def test_earliest_constraint_applies_timezone_offset(self):
        base_ts = 1693526400  # 2023-09-01 00:00:00 UTC
        forecast = [
            _forecast_block(base_ts),
            _forecast_block(base_ts + 10800),
        ]
        result = find_windows.find_windows(
            forecast=forecast,
            min_temp=None,
            max_temp=None,
            min_humidity=None,
            max_humidity=None,
            no_rain=False,
            duration_hours=3,
            earliest_start="04:00",
            latest_start=None,
            timezone_offset=7200,  # UTC+2
        )
        self.assertEqual(len(result["windows"]), 1)
        window = result["windows"][0]
        self.assertEqual(window["start_ts"], forecast[1]["dt"])
        self.assertEqual(window["display"], "9/1 5 AM - 8 AM")
        self.assertIn(
            {"reason": "start before earliest allowed (02:00)", "count": 1},
            result["reason_details"],
        )

    def test_latest_constraint_applies_timezone_offset(self):
        base_ts = 1693526400  # 2023-09-01 00:00:00 UTC
        forecast = [
            _forecast_block(base_ts),
            _forecast_block(base_ts + 10800),
        ]
        result = find_windows.find_windows(
            forecast=forecast,
            min_temp=None,
            max_temp=None,
            min_humidity=None,
            max_humidity=None,
            no_rain=False,
            duration_hours=3,
            earliest_start=None,
            latest_start="02:00",
            timezone_offset=-10800,  # UTC-3
        )
        self.assertEqual(len(result["windows"]), 1)
        window = result["windows"][0]
        self.assertEqual(window["start_ts"], forecast[1]["dt"])
        self.assertEqual(window["display"], "9/1 12 AM - 3 AM")
        self.assertIn(
            {"reason": "start after latest allowed (21:00)", "count": 1},
            result["reason_details"],
        )


if __name__ == "__main__":
    unittest.main()
