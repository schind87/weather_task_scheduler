# frozen_string_literal: true

class TasksController < ApplicationController
  protect_from_forgery with: :null_session

  before_action :set_task, only: %i[show update destroy]

  rescue_from WeatherService::Error, with: :handle_weather_error
  rescue_from ArgumentError, with: :handle_argument_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found

  def index
    tasks = Task.order(created_at: :desc)
    render json: tasks
  end

  def show
    render json: @task
  end

  def create
    task = Task.new(task_params)
    unless task.valid?
      return render_validation_errors(task)
    end

    forecast, timezone_offset = WeatherService.fetch_hourly_forecast(task.location)
    window_result = find_windows_for(task, forecast, timezone_offset)
    apply_schedule(task, window_result[:windows])

    task.save!
    render json: mutation_response(task, window_result)
  rescue ActiveRecord::RecordInvalid
    render_validation_errors(task)
  end

  def update
    @task.assign_attributes(task_params)
    unless @task.valid?
      errors = @task.errors.full_messages
      @task.reload
      return render_validation_errors(@task, errors)
    end

    forecast, timezone_offset = WeatherService.fetch_hourly_forecast(@task.location)
    window_result = find_windows_for(@task, forecast, timezone_offset)
    apply_schedule(@task, window_result[:windows])

    @task.save!
    render json: mutation_response(@task, window_result)
  rescue ActiveRecord::RecordInvalid
    render_validation_errors(@task)
  end

  def destroy
    if @task.destroy
      render json: { ok: true }
    else
      render json: { ok: false }, status: :internal_server_error
    end
  end

  private

  def task_params
    params.permit(
      :name,
      :duration_hours,
      :min_temp,
      :max_temp,
      :min_humidity,
      :max_humidity,
      :no_rain,
      :location,
      :earliest_start,
      :latest_start
    )
  end

  def set_task
    @task = Task.find(params[:id])
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

  def render_validation_errors(task, errors = nil)
    render json: { errors: errors || task.errors.full_messages }, status: :unprocessable_entity
  end

  def find_windows_for(task, forecast, timezone_offset)
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

  def apply_schedule(task, windows)
    first_window = windows.first
    task.scheduled_time = if first_window
                            Time.at(first_window[:start_ts]).utc
                          else
                            nil
                          end
  end

  def mutation_response(task, window_result)
    {
      task: task.as_json,
      possible_windows: window_result[:windows],
      reason_summary: window_result[:reason_summary],
      reason_details: window_result[:reason_details]
    }
  end
end
