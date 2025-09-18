# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

module WeatherService
  class Error < StandardError
    attr_reader :status_code

    def initialize(message, status_code: 502)
      super(message)
      @status_code = status_code
    end
  end

  module_function

  def fetch_hourly_forecast(zip_code)
    normalized_zip = normalize_zip(zip_code)
    response = perform_request(normalized_zip)
    data = parse_response_body(response)
    forecast_blocks = extract_forecast_blocks(data)
    timezone_offset = extract_timezone_offset(data)
    [forecast_blocks, timezone_offset]
  end

  def api_key
    key = ENV.fetch("OPENWEATHER_API_KEY", "").strip
    return key if key.present?

    raise Error.new(
      "OPENWEATHER_API_KEY environment variable must be set to contact OpenWeather.",
      status_code: 500
    )
  end
  private_class_method :api_key

  def normalize_zip(zip_code)
    raise ArgumentError, "ZIP code is required." if zip_code.nil?

    cleaned = zip_code.to_s.strip
    raise ArgumentError, "ZIP code is required." if cleaned.empty?

    country = "US"
    if cleaned.include?(",")
      base, remainder = cleaned.split(",", 2)
      cleaned = base.strip
      remainder = remainder.to_s.strip
      country = remainder.upcase if remainder.present?
    end

    digits = cleaned.gsub(/\D/, "")
    unless [5, 9].include?(digits.length)
      raise ArgumentError, "ZIP code must include 5 or 9 digits."
    end

    "#{digits},#{country}"
  end
  private_class_method :normalize_zip

  def perform_request(normalized_zip)
    uri = URI.parse("https://api.openweathermap.org/data/2.5/forecast")
    uri.query = URI.encode_www_form(zip: normalized_zip, appid: api_key, units: "imperial")

    request = Net::HTTP::Get.new(uri)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 10
    http.start { |client| client.request(request) }
  rescue Timeout::Error, IOError, SystemCallError => e
    raise Error.new("Unable to reach weather service.", status_code: 503), cause: e
  end
  private_class_method :perform_request

  def parse_response_body(response)
    unless response.is_a?(Net::HTTPSuccess)
      raise build_api_error(response)
    end

    JSON.parse(response.body)
  rescue JSON::ParserError => e
    raise Error.new("Weather service returned invalid JSON.", status_code: 502), cause: e
  end
  private_class_method :parse_response_body

  def extract_forecast_blocks(data)
    list = data["list"]
    unless list.is_a?(Array)
      message = if data.is_a?(Hash)
                  data["message"].presence || "Unknown error from weather API."
                else
                  "Unknown error from weather API."
                end
      raise Error.new("Weather API error: #{message}", status_code: 502)
    end

    list.map do |entry|
      main = entry.is_a?(Hash) ? entry["main"] : nil
      {
        dt: entry["dt"],
        temp: main.is_a?(Hash) ? main["temp"] : nil,
        rain: entry.fetch("rain", {})&.fetch("3h", 0) || 0,
        humidity: main.is_a?(Hash) ? main["humidity"] : nil
      }
    end
  end
  private_class_method :extract_forecast_blocks

  def extract_timezone_offset(data)
    city = data["city"]
    offset = city.is_a?(Hash) ? city["timezone"] : nil
    offset.is_a?(Numeric) ? offset.to_i : 0
  end
  private_class_method :extract_timezone_offset

  def build_api_error(response)
    status = response.code.to_i
    payload_message = parse_error_message(response)
    text_detail = response.body.to_s.strip

    base_message, http_status = friendly_status_message(status)
    detail = payload_message || text_detail.presence

    message = if detail && !base_message.include?(detail)
                "#{base_message} Details: #{detail}"
              else
                base_message
              end

    Error.new(message, status_code: http_status)
  end
  private_class_method :build_api_error

  def parse_error_message(response)
    payload = JSON.parse(response.body)
    return unless payload.is_a?(Hash)

    message = payload["message"]
    return unless message.is_a?(String)

    truncate_detail(message)
  rescue JSON::ParserError
    nil
  end
  private_class_method :parse_error_message

  def friendly_status_message(status)
    case status
    when 401
      [
        "Authentication with OpenWeather failed. Verify the OPENWEATHER_API_KEY credential.",
        500
      ]
    when 404
      [
        "No forecast data found for the requested ZIP code. Please confirm the location.",
        400
      ]
    when 429
      [
        "OpenWeather request limit exceeded. Please wait before retrying.",
        429
      ]
    else
      ["OpenWeather API request failed with status #{status}.", 502]
    end
  end
  private_class_method :friendly_status_message

  def truncate_detail(detail, max_length = 200)
    stripped = detail.to_s.strip
    return stripped if stripped.length <= max_length

    "#{stripped[0, max_length - 3]}..."
  end
  private_class_method :truncate_detail
end
