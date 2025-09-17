import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.find_windows import find_windows


BASE_TS = 1_700_000_000
BLOCK_HOURS = 3
BLOCK_SECONDS = BLOCK_HOURS * 3600


def make_block(index: int, **overrides):
    block = {
        'dt': BASE_TS + index * BLOCK_SECONDS,
        'temp': 70.0,
        'rain': 0.0,
        'humidity': 50,
    }
    block.update(overrides)
    return block


def test_window_returned_when_post_duration_block_has_rain():
    forecast = [
        make_block(0),
        make_block(1),
        make_block(2, rain=1.0),
    ]

    result = find_windows(
        forecast=forecast,
        min_temp=None,
        max_temp=None,
        min_humidity=None,
        max_humidity=None,
        no_rain=True,
        duration_hours=6,
    )

    assert len(result['windows']) == 1
    window = result['windows'][0]
    assert window['start_ts'] == forecast[0]['dt']
    assert window['duration'] == '6h'
    assert result['reason_summary'] is None
    assert any(detail['reason'] == 'rain expected during window' for detail in result['reason_details'])


def test_window_returned_when_post_duration_block_has_gap():
    gap_block = make_block(2)
    gap_block['dt'] = make_block(1)['dt'] + 2 * 3600

    forecast = [
        make_block(0),
        make_block(1),
        gap_block,
    ]

    result = find_windows(
        forecast=forecast,
        min_temp=None,
        max_temp=None,
        min_humidity=None,
        max_humidity=None,
        no_rain=False,
        duration_hours=6,
    )

    assert len(result['windows']) == 1
    window = result['windows'][0]
    assert window['start_ts'] == forecast[0]['dt']
    assert window['duration'] == '6h'
    assert result['reason_summary'] is None
    assert any(
        detail['reason'] == 'forecast horizon ended before reaching required duration'
        for detail in result['reason_details']
    )
