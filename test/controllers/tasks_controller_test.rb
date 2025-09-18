require "test_helper"
require "json"
require "time"

class TasksControllerTest < ActionDispatch::IntegrationTest
  test "create task returns window using weather timezone" do
    base_ts = 1_693_526_400
    forecast = [
      { dt: base_ts, temp: 70.0, rain: 0.0, humidity: 40 },
      { dt: base_ts + 10_800, temp: 72.0, rain: 0.0, humidity: 42 }
    ]
    timezone_offset = 7_200

    WeatherService.stub(:fetch_hourly_forecast, ->(_zip) { [forecast, timezone_offset] }) do
      payload = {
        name: "Morning gardening",
        duration_hours: 3,
        min_temp: nil,
        max_temp: nil,
        min_humidity: nil,
        max_humidity: nil,
        no_rain: true,
        location: "12345",
        earliest_start: "04:00",
        latest_start: nil
      }

      post tasks_url, params: payload, as: :json
      assert_response :success

      body = JSON.parse(response.body)
      windows = body.fetch("possible_windows")
      assert_equal 1, windows.length
      first_window = windows.first
      assert_equal forecast[1][:dt], first_window.fetch("start_ts")
      assert_equal "9/1 5 AM - 8 AM", first_window.fetch("display")
      assert_nil body["reason_summary"]
      assert_includes body.fetch("reason_details"), { "reason" => "start before earliest allowed (02:00)", "count" => 1 }

      scheduled_time = Time.iso8601(body.fetch("task").fetch("scheduled_time"))
      assert_equal Time.at(forecast[1][:dt]).utc, scheduled_time
    end
  end

  test "suggestions endpoint respects timezone" do
    base_ts = 1_693_526_400
    forecast = [
      { dt: base_ts, temp: 68.0, rain: 0.0, humidity: 45 },
      { dt: base_ts + 10_800, temp: 70.0, rain: 0.0, humidity: 43 }
    ]
    timezone_offset = -3_600

    task = Task.create!(
      name: "Overnight maintenance",
      duration_hours: 3,
      min_temp: nil,
      max_temp: nil,
      min_humidity: nil,
      max_humidity: nil,
      no_rain: true,
      location: "94107",
      earliest_start: "23:00",
      latest_start: nil
    )

    WeatherService.stub(:fetch_hourly_forecast, ->(_zip) { [forecast, timezone_offset] }) do
      post suggestions_url, params: { task_id: task.id }, as: :json
      assert_response :success

      body = JSON.parse(response.body)
      windows = body.fetch("possible_windows")
      assert_equal 1, windows.length
      first_window = windows.first
      assert_equal forecast[0][:dt], first_window.fetch("start_ts")
      assert_equal "8/31 11 PM - 9/1 2 AM", first_window.fetch("display")
      assert_nil body["reason_summary"]
      assert_includes body.fetch("reason_details"), { "reason" => "start before earliest allowed (02:00)", "count" => 1 }
    end
  end
end
