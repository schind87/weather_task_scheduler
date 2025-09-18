class TasksController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :set_task, only: %i[show update destroy]

  def index
    tasks = Task.recent
    render json: tasks.map { |task| task_payload(task) }
  end

  def show
    return render_task_not_found unless @task

    render json: task_payload(@task)
  end

  def create
    @task = Task.new(task_params)

    unless @task.valid?
      return render json: { errors: @task.errors.full_messages }, status: :unprocessable_content
    end

    window_result = compute_windows(@task)
    assign_scheduled_time(@task, window_result)

    if @task.save
      render json: build_task_response(@task, window_result), status: :created
    else
      render json: { errors: @task.errors.full_messages }, status: :unprocessable_content
    end
  rescue WeatherServiceError => e
    render json: { detail: e.message }, status: e.status_code
  rescue ArgumentError => e
    render json: { detail: e.message }, status: :bad_request
  end

  def update
    return render_task_not_found unless @task

    @task.assign_attributes(task_params)

    unless @task.valid?
      return render json: { errors: @task.errors.full_messages }, status: :unprocessable_content
    end

    window_result = compute_windows(@task)
    assign_scheduled_time(@task, window_result)

    if @task.save
      render json: build_task_response(@task, window_result)
    else
      render json: { errors: @task.errors.full_messages }, status: :unprocessable_content
    end
  rescue WeatherServiceError => e
    render json: { detail: e.message }, status: e.status_code
  rescue ArgumentError => e
    render json: { detail: e.message }, status: :bad_request
  end

  def destroy
    return render_task_not_found unless @task

    @task.destroy
    render json: { ok: true }
  end

  private

  def set_task
    @task = Task.find_by(id: params[:id])
  end

  def render_task_not_found
    render json: { detail: 'Task not found' }, status: :not_found
  end

  def task_params
    params.require(:task).permit(
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

  def compute_windows(task)
    forecast, timezone_offset = weather_client.fetch_hourly_forecast(task.location)
    FindWindows.call(
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
  end

  def assign_scheduled_time(task, window_result)
    first_window = window_result.windows.first
    task.scheduled_time = if first_window
                            Time.at(first_window[:start_ts]).utc
                          else
                            nil
                          end
  end

  def weather_client
    @weather_client ||= WeatherClient.new
  end

  def task_payload(task)
    task.as_json(only: %i[
                       id name duration_hours min_temp max_temp min_humidity max_humidity
                       no_rain location scheduled_time earliest_start latest_start created_at
                     ])
  end

  def build_task_response(task, window_result)
    {
      task: task_payload(task),
      possible_windows: window_result.windows.as_json,
      reason_summary: window_result.reason_summary,
      reason_details: window_result.reason_details.as_json
    }
  end
end
