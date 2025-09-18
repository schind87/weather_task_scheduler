require "test_helper"

class FindWindowsTest < ActiveSupport::TestCase
  setup do
    @forecast = [
      { "dt" => 1_700_000_000, "temp" => 70.0, "rain" => 0, "humidity" => 40 },
      { "dt" => 1_700_010_800, "temp" => 72.0, "rain" => 0, "humidity" => 42 },
      { "dt" => 1_700_021_600, "temp" => 74.0, "rain" => 0, "humidity" => 45 }
    ]
  end

  test "returns windows when constraints are met" do
    result = FindWindows.call(
      forecast: @forecast,
      min_temp: 65.0,
      max_temp: 80.0,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 3,
      earliest_start: nil,
      latest_start: nil,
      timezone_offset: 0
    )

    assert_nil result.reason_summary
    assert_equal 3, result.windows.first[:duration].delete_suffix("h").to_i
    assert_equal 1_700_000_000, result.windows.first[:start_ts]
  end

  test "returns reason summary when constraints fail" do
    result = FindWindows.call(
      forecast: @forecast,
      min_temp: 80.0,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 3,
      earliest_start: nil,
      latest_start: nil,
      timezone_offset: 0
    )

    assert_empty result.windows
    assert_match(/temperature below minimum/, result.reason_summary)
  end

  test "enforces earliest start window" do
    result = FindWindows.call(
      forecast: @forecast,
      min_temp: 60.0,
      max_temp: 80.0,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      duration_hours: 3,
      earliest_start: "23:00",
      latest_start: nil,
      timezone_offset: 0
    )

    assert_empty result.windows
    assert_match(/No windows matched/, result.reason_summary)
    assert result.reason_details.any? { |detail| detail[:reason].include?("earliest") }
  end
end
