class FindWindows
  BlockHours = 3

  Result = Struct.new(:windows, :reason_summary, :reason_details, keyword_init: true)

  def self.call(**kwargs)
    new(**kwargs).call
  end

  def initialize(forecast:, min_temp:, max_temp:, min_humidity:, max_humidity:,
                 no_rain:, duration_hours:, earliest_start: nil, latest_start: nil,
                 timezone_offset: 0)
    @forecast = forecast || []
    @min_temp = min_temp
    @max_temp = max_temp
    @min_humidity = min_humidity
    @max_humidity = max_humidity
    @no_rain = no_rain
    @duration_hours = duration_hours
    @earliest = parse_time_string(earliest_start)
    @latest = parse_time_string(latest_start)
    @timezone_offset = timezone_offset.to_i
  end

  def call
    return empty_result('No forecast data was returned for this ZIP code.') if forecast.empty?
    return empty_result('Duration must be greater than zero.') if duration_hours.to_i <= 0

    max_available = BlockHours * forecast.length
    if duration_hours > max_available
      summary = 'Forecast horizon is shorter than the required task duration.'
      return empty_result(summary)
    end

    windows = []
    failures = Hash.new(0)

    i = 0
    while i < forecast.length
      start_idx = i
      total_hours = 0
      j = i
      block = forecast[start_idx]
      window_start = block_dt(block)
      last_dt = window_start
      window_failed = false
      window_emitted = false

      while j < forecast.length
        block = forecast[j]
        current_dt = block_dt(block)
        if j > start_idx && current_dt - last_dt != BlockHours * 3600
          failures['forecast data gaps prevent continuous window'] += 1
          window_failed = true
          break
        end

        enforce_time = (j == start_idx)
        block_valid, reason = check_constraints(block, enforce_time: enforce_time)
        unless block_valid
          failures[reason] += 1 if reason
          window_failed = true
          break
        end

        total_hours += BlockHours
        last_dt = current_dt
        j += 1

        if total_hours >= duration_hours
          window_emitted = true
          break
        end
      end

      if !window_emitted && total_hours < duration_hours && j >= forecast.length
        failures['forecast horizon ended before reaching required duration'] += 1
      end

      if !window_failed && total_hours >= duration_hours
        window_end = last_dt + BlockHours * 3600
        actual_hours = ((window_end - window_start) / 3600).to_i
        windows << {
          display: format_window(window_start, window_end),
          start_ts: window_start,
          duration: "#{actual_hours}h"
        }
      end

      i = j > i ? j : i + 1
    end

    if windows.empty?
      summary = summarize_failures(failures) || 'No windows matched all constraints.'
    else
      summary = nil
    end

    Result.new(
      windows: windows,
      reason_summary: summary,
      reason_details: failures.map { |reason, count| { reason: reason, count: count } }
        .sort_by { |entry| -entry[:count] }
    )
  end

  private

  attr_reader :forecast, :min_temp, :max_temp, :min_humidity, :max_humidity,
              :no_rain, :duration_hours, :earliest, :latest, :timezone_offset

  def parse_time_string(value)
    return nil if value.blank?
    hour_str, minute_str = value.split(':', 2)
    [hour_str.to_i, minute_str.to_i]
  rescue StandardError
    nil
  end

  def block_dt(block)
    block['dt'] || block[:dt]
  end

  def block_temp(block)
    block['temp'] || block[:temp]
  end

  def block_rain(block)
    value = block['rain'] || block[:rain] || 0
    value || 0
  end

  def block_humidity(block)
    block['humidity'] || block[:humidity]
  end

  def check_constraints(block, enforce_time: true)
    temp = block_temp(block)
    return [false, 'temperature missing from forecast'] if temp.nil?

    if min_temp && temp < min_temp
      return [false, format('temperature below minimum (%.0fF < %.0fF)', temp, min_temp)]
    end
    if max_temp && temp > max_temp
      return [false, format('temperature above maximum (%.0fF > %.0fF)', temp, max_temp)]
    end

    humidity = block_humidity(block)
    if min_humidity
      return [false, 'humidity missing from forecast'] if humidity.nil?
      if humidity < min_humidity
        return [false, format('humidity below minimum (%d%% < %d%%)', humidity, min_humidity)]
      end
    end
    if max_humidity
      return [false, 'humidity missing from forecast'] if humidity.nil?
      if humidity > max_humidity
        return [false, format('humidity above maximum (%d%% > %d%%)', humidity, max_humidity)]
      end
    end

    if no_rain && block_rain(block).to_f > 0
      return [false, 'rain expected during window']
    end

    if enforce_time && (earliest || latest)
      dt_local = to_timezone_time(block_dt(block))
      current_minutes = time_to_minutes([dt_local.hour, dt_local.min])
      if earliest && current_minutes < time_to_minutes(earliest)
        return [false, format('start before earliest allowed (%02d:%02d)', dt_local.hour, dt_local.min)]
      end
      if latest && current_minutes > time_to_minutes(latest)
        return [false, format('start after latest allowed (%02d:%02d)', dt_local.hour, dt_local.min)]
      end
    end

    [true, nil]
  end

  def to_timezone_time(timestamp)
    Time.at(timestamp + timezone_offset).utc
  end

  def format_window(start_ts, end_ts)
    start_local = to_timezone_time(start_ts)
    end_local = to_timezone_time(end_ts)

    start_month = start_local.month.to_s
    start_day = start_local.day.to_s
    start_hour = start_local.hour % 12
    start_hour = 12 if start_hour.zero?
    start_ampm = start_local.hour < 12 ? 'AM' : 'PM'

    end_month = end_local.month.to_s
    end_day = end_local.day.to_s
    end_hour = end_local.hour % 12
    end_hour = 12 if end_hour.zero?
    end_ampm = end_local.hour < 12 ? 'AM' : 'PM'

    if start_local.month != end_local.month || start_local.day != end_local.day
      "#{start_month}/#{start_day} #{start_hour} #{start_ampm} - #{end_month}/#{end_day} #{end_hour} #{end_ampm}"
    else
      "#{start_month}/#{start_day} #{start_hour} #{start_ampm} - #{end_hour} #{end_ampm}"
    end
  end

  def summarize_failures(failures)
    return if failures.empty?

    most_common = failures.sort_by { |_, count| -count }.first(3)
    formatted = most_common.map { |reason, count| "#{reason} (x#{count})" }.join(', ')
    "No windows matched all constraints. Common blockers: #{formatted}."
  end

  def time_to_minutes(pair)
    pair[0].to_i * 60 + pair[1].to_i
  end

  def empty_result(summary)
    Result.new(windows: [], reason_summary: summary, reason_details: [])
  end
end
