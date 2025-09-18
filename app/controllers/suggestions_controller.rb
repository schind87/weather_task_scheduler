class SuggestionsController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    task = Task.find_by(id: suggestion_params[:task_id])
    return render json: { detail: 'Task not found' }, status: :not_found unless task

    forecast, timezone_offset = weather_client.fetch_hourly_forecast(task.location)
    window_result = FindWindows.call(
      forecast: forecast,
      min_temp: task.min_temp,
      max_temp: task.max_temp,
      min_humidity: task.min_humidity,
      max_humidity: task.max_humidity,
      no_rain: task.no_rain?,
      duration_hours: task.duration_hours,
      earliest_start: task.earliest_start,
      latest_start: task.latest_start,
      timezone_offset: timezone_offset
    )

    render json: {
      possible_windows: window_result.windows.as_json,
      reason_summary: window_result.reason_summary,
      reason_details: window_result.reason_details.as_json
    }
  rescue WeatherServiceError => e
    render json: { detail: e.message }, status: e.status_code
  rescue ArgumentError => e
    render json: { detail: e.message }, status: :bad_request
  end

  private

  def suggestion_params
    params.permit(:task_id)
  end

  def weather_client
    @weather_client ||= WeatherClient.new
  end
end
