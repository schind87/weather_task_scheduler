require "test_helper"

class WindowFinderTest < ActiveSupport::TestCase
  BASE_TS = 1_700_000_000
  BLOCK_HOURS = 3
  BLOCK_SECONDS = BLOCK_HOURS * 3600

  def make_block(index, **overrides)
    {
      dt: BASE_TS + index * BLOCK_SECONDS,
      temp: 70.0,
      rain: 0.0,
      humidity: 50
    }.merge(overrides)
  end

  test "window returned when block after duration has rain" do
    forecast = [
      make_block(0),
      make_block(1),
      make_block(2, rain: 1.0)
    ]

    result = WindowFinder.find_windows(
      forecast: forecast,
      min_temp: nil,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 6
    )

    assert_equal 1, result[:windows].length
    window = result[:windows].first
    assert_equal forecast[0][:dt], window[:start_ts]
    assert_equal "6h", window[:duration]
    assert_nil result[:reason_summary]
    assert_includes result[:reason_details], { reason: "rain expected during window", count: 1 }
  end

  test "window returned when data gap occurs after duration" do
    gap_block = make_block(2)
    gap_block[:dt] = make_block(1)[:dt] + 2 * 3600

    forecast = [
      make_block(0),
      make_block(1),
      gap_block
    ]

    result = WindowFinder.find_windows(
      forecast: forecast,
      min_temp: nil,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: false,
      duration_hours: 6
    )

    assert_equal 1, result[:windows].length
    window = result[:windows].first
    assert_equal forecast[0][:dt], window[:start_ts]
    assert_equal "6h", window[:duration]
    assert_nil result[:reason_summary]
    assert_includes result[:reason_details], { reason: "forecast horizon ended before reaching required duration", count: 1 }
  end

  test "earliest constraint applies timezone offset" do
    base_ts = 1_693_526_400 # 2023-09-01 00:00:00 UTC
    forecast = [
      { dt: base_ts, temp: 70.0, rain: 0.0, humidity: 40 },
      { dt: base_ts + BLOCK_SECONDS, temp: 72.0, rain: 0.0, humidity: 42 }
    ]

    result = WindowFinder.find_windows(
      forecast: forecast,
      min_temp: nil,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 3,
      earliest_start: "04:00",
      latest_start: nil,
      timezone_offset: 7200
    )

    assert_equal 1, result[:windows].length
    window = result[:windows].first
    assert_equal forecast[1][:dt], window[:start_ts]
    assert_equal "9/1 5 AM - 8 AM", window[:display]
    assert_includes result[:reason_details], { reason: "start before earliest allowed (02:00)", count: 1 }
  end

  test "latest constraint applies timezone offset" do
    base_ts = 1_693_526_400
    forecast = [
      { dt: base_ts, temp: 68.0, rain: 0.0, humidity: 45 },
      { dt: base_ts + BLOCK_SECONDS, temp: 70.0, rain: 0.0, humidity: 43 }
    ]

    result = WindowFinder.find_windows(
      forecast: forecast,
      min_temp: nil,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 3,
      earliest_start: nil,
      latest_start: "02:00",
      timezone_offset: -10_800
    )

    assert_equal 1, result[:windows].length
    window = result[:windows].first
    assert_equal forecast[1][:dt], window[:start_ts]
    assert_equal "9/1 12 AM - 3 AM", window[:display]
    assert_includes result[:reason_details], { reason: "start after latest allowed (21:00)", count: 1 }
  end
end
