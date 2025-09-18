# frozen_string_literal: true

module WindowFinder
  BLOCK_HOURS = 3
  BLOCK_SECONDS = BLOCK_HOURS * 3600

  module_function

  def find_windows(
    forecast:,
    min_temp:,
    max_temp:,
    min_humidity:,
    max_humidity:,
    no_rain:,
    duration_hours:,
    earliest_start: nil,
    latest_start: nil,
    timezone_offset: 0
  )
    forecast = Array(forecast)
    return empty_result("No forecast data was returned for this ZIP code.") if forecast.empty?

    duration = duration_hours.to_i
    return empty_result("Duration must be greater than zero.") if duration <= 0

    earliest = parse_time_string(earliest_start)
    latest = parse_time_string(latest_start)
    failures = Hash.new(0)
    valid_windows = []

    max_available = BLOCK_HOURS * forecast.length
    if duration > max_available
      summary = "Forecast horizon is shorter than the required task duration."
      return empty_result(summary)
    end

    i = 0
    while i < forecast.length
      start_idx = i
      total_hours = 0
      j = i
      block = forecast[start_idx] || {}
      window_start = block[:dt] || block["dt"]
      last_dt = window_start
      window_failed = false
      window_emitted = false

      while j < forecast.length
        block = forecast[j] || {}
        current_dt = block[:dt] || block["dt"]
        if current_dt.nil?
          failures["forecast data missing timestamp"] += 1
          window_failed = true
          break
        end

        if j > start_idx && last_dt && current_dt - last_dt != BLOCK_SECONDS
          failures["forecast data gaps prevent continuous window"] += 1
          window_failed = true
          break
        end

        enforce_time = j == start_idx
        block_valid, block_reason = check_constraints(
          block,
          min_temp,
          max_temp,
          min_humidity,
          max_humidity,
          no_rain,
          earliest,
          latest,
          enforce_time: enforce_time,
          timezone_offset: timezone_offset
        )

        unless block_valid
          failures[block_reason] += 1 if block_reason
          window_failed = true
          break
        end

        total_hours += BLOCK_HOURS
        last_dt = current_dt
        j += 1
        if total_hours >= duration
          window_emitted = true
          break
        end
      end

      if !window_emitted && total_hours < duration && j >= forecast.length
        failures["forecast horizon ended before reaching required duration"] += 1
      end

      if !window_failed && total_hours >= duration
        window_end = last_dt.to_i + BLOCK_SECONDS
        window_start = last_dt.to_i if window_start.nil?
        actual_hours = ((window_end - window_start) / 3600).to_i
        valid_windows << {
          display: format_window(window_start, window_end, timezone_offset),
          start_ts: window_start,
          duration: "#{actual_hours}h"
        }
      end

      i = j > i ? j : i + 1
    end

    summary = nil
    if valid_windows.empty?
      summary = summarize_failures(failures)
      summary ||= "No windows matched all constraints."
    end

    reason_details = failures.sort_by { |_, count| -count }
                               .map { |reason, count| { reason: reason, count: count } }

    {
      windows: valid_windows,
      reason_summary: summary,
      reason_details: reason_details
    }
  end

  def empty_result(summary)
    { windows: [], reason_summary: summary, reason_details: [] }
  end
  private_class_method :empty_result

  def parse_time_string(value)
    return nil if value.blank?

    string = value.to_s.strip
    return nil if string.empty?

    parts = string.split(":")
    return nil unless parts.length == 2

    hour = Integer(parts[0], exception: false)
    minute = Integer(parts[1], exception: false)
    return nil if hour.nil? || minute.nil?

    hour * 60 + minute
  end
  private_class_method :parse_time_string

  def to_timezone_time(timestamp, timezone_offset)
    Time.at(timestamp.to_i + timezone_offset.to_i).utc
  end
  private_class_method :to_timezone_time

  def format_window(start_ts, end_ts, timezone_offset)
    start_local = to_timezone_time(start_ts, timezone_offset)
    end_local = to_timezone_time(end_ts, timezone_offset)

    start_month = start_local.month
    start_day = start_local.day
    start_hour = (start_local.hour % 12).zero? ? 12 : start_local.hour % 12
    start_ampm = start_local.hour < 12 ? "AM" : "PM"

    end_month = end_local.month
    end_day = end_local.day
    end_hour = (end_local.hour % 12).zero? ? 12 : end_local.hour % 12
    end_ampm = end_local.hour < 12 ? "AM" : "PM"

    if start_month != end_month || start_day != end_day
      "#{start_month}/#{start_day} #{start_hour} #{start_ampm} - #{end_month}/#{end_day} #{end_hour} #{end_ampm}"
    else
      "#{start_month}/#{start_day} #{start_hour} #{start_ampm} - #{end_hour} #{end_ampm}"
    end
  end
  private_class_method :format_window

  def check_constraints(
    block,
    min_temp,
    max_temp,
    min_humidity,
    max_humidity,
    no_rain,
    earliest,
    latest,
    enforce_time:,
    timezone_offset:
  )
    temperature = block[:temp] || block["temp"]
    rain = block[:rain] || block["rain"] || 0
    humidity = block[:humidity] || block["humidity"]
    timestamp = block[:dt] || block["dt"]

    return [false, "temperature missing from forecast"] if temperature.nil?

    if !min_temp.nil? && temperature < min_temp
      return [false, format("temperature below minimum (%.0fF < %.0fF)", temperature, min_temp)]
    end

    if !max_temp.nil? && temperature > max_temp
      return [false, format("temperature above maximum (%.0fF > %.0fF)", temperature, max_temp)]
    end

    if !min_humidity.nil?
      return [false, "humidity missing from forecast"] if humidity.nil?
      if humidity < min_humidity
        return [false, format("humidity below minimum (%d% < %d%)", humidity, min_humidity)]
      end
    end

    if !max_humidity.nil?
      return [false, "humidity missing from forecast"] if humidity.nil?
      if humidity > max_humidity
        return [false, format("humidity above maximum (%d% > %d%)", humidity, max_humidity)]
      end
    end

    rain_amount = rain || 0
    return [false, "rain expected during window"] if ActiveModel::Type::Boolean.new.cast(no_rain) && rain_amount.to_f > 0

    if enforce_time && (earliest || latest) && timestamp
      local_time = to_timezone_time(timestamp, timezone_offset)
      current_minutes = local_time.hour * 60 + local_time.min

      if earliest && current_minutes < earliest
        return [false, format("start before earliest allowed (%02d:%02d)", local_time.hour, local_time.min)]
      end

      if latest && current_minutes > latest
        return [false, format("start after latest allowed (%02d:%02d)", local_time.hour, local_time.min)]
      end
    end

    [true, nil]
  end
  private_class_method :check_constraints

  def summarize_failures(failures)
    return nil if failures.empty?

    top = failures.sort_by { |_, count| -count }.first(3)
    formatted = top.map { |reason, count| "#{reason} (x#{count})" }.join(", ")
    "No windows matched all constraints. Common blockers: #{formatted}."
  end
  private_class_method :summarize_failures
end
