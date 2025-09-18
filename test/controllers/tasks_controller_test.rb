require "test_helper"

class TasksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @forecast = [
      { "dt" => 1_700_000_000, "temp" => 70.0, "rain" => 0, "humidity" => 40 }
    ]
  end

  test "creates task and returns windows" do
    mock_client = Minitest::Mock.new
    mock_client.expect(:fetch_hourly_forecast, [@forecast, 0], ["97201"])

    WeatherClient.stub :new, mock_client do
      assert_difference("Task.count") do
        post tasks_url, params: {
          task: {
            name: "Plant Seeds",
            duration_hours: 3,
            location: "97201",
            min_temp: 60.0,
            max_temp: 80.0,
            no_rain: true
          }
        }, as: :json
      end
    end
    mock_client.verify

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal "Plant Seeds", body.dig("task", "name")
    assert_equal 1, body.fetch("possible_windows").size
    assert_nil body["reason_summary"]
    assert_not_nil Task.last.scheduled_time
  end

  test "returns validation errors for invalid task" do
    post tasks_url, params: { task: { name: "", duration_hours: 0, location: "" } }, as: :json

    assert_response :unprocessable_content
    body = JSON.parse(response.body)
    assert_includes body["errors"], "Name can't be blank"
  end

  test "updates task and refreshes scheduled_time" do
    task = Task.create!(name: "Water Garden", duration_hours: 3, location: "97201")

    mock_client = Minitest::Mock.new
    mock_client.expect(:fetch_hourly_forecast, [@forecast, 0], ["97201"])

    WeatherClient.stub :new, mock_client do
      put task_url(task), params: {
        task: {
          min_temp: 65.0,
          max_temp: 75.0
        }
      }, as: :json
    end
    mock_client.verify

    assert_response :success
    task.reload
    assert_equal 65.0, task.min_temp
    body = JSON.parse(response.body)
    assert_equal 1, body.fetch("possible_windows").size
  end
end
