# frozen_string_literal: true

class SuggestionsController < ApplicationController
  protect_from_forgery with: :null_session

  rescue_from WeatherService::Error, with: :handle_weather_error
  rescue_from ArgumentError, with: :handle_argument_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found

  def create
    task_id = params[:task_id]
    raise ArgumentError, "task_id is required" if task_id.blank?

    task = Task.find(task_id)
    forecast, timezone_offset = WeatherService.fetch_hourly_forecast(task.location)
    result = build_window_result(task, forecast, timezone_offset)
    render json: format_window_response(result)
  end

  private

  def build_window_result(task, forecast, timezone_offset)
    WindowFinder.find_windows(
      forecast: forecast,
      min_temp: task.min_temp,
      max_temp: task.max_temp,
      min_humidity: task.min_humidity,
      max_humidity: task.max_humidity,
      no_rain: task.no_rain,
      duration_hours: task.duration_hours,
      earliest_start: task.earliest_start,
      latest_start: task.latest_start,
      timezone_offset: timezone_offset
    )
  end

  def format_window_response(result)
    {
      possible_windows: result[:windows],
      reason_summary: result[:reason_summary],
      reason_details: result[:reason_details]
    }
  end

  def handle_weather_error(error)
    render json: { detail: error.message }, status: error.status_code
  end

  def handle_argument_error(error)
    render json: { detail: error.message }, status: :bad_request
  end

  def handle_not_found
    render json: { detail: "Task not found" }, status: :not_found
  end
end
