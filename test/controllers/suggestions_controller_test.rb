require "test_helper"

class SuggestionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @task = Task.create!(name: "Trim Hedge", duration_hours: 3, location: "97201")
    @forecast = [
      { "dt" => 1_700_000_000, "temp" => 70.0, "rain" => 0, "humidity" => 40 }
    ]
  end

  test "returns suggestions for task" do
    mock_client = Minitest::Mock.new
    mock_client.expect(:fetch_hourly_forecast, [@forecast, 0], [@task.location])

    WeatherClient.stub :new, mock_client do
      post suggestions_url, params: { task_id: @task.id }, as: :json
    end
    mock_client.verify

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body.fetch("possible_windows").size
  end

  test "responds with not found when task missing" do
    post suggestions_url, params: { task_id: 9999 }, as: :json

    assert_response :not_found
  end
end
