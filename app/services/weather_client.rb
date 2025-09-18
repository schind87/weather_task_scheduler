require 'net/http'
require 'json'

class WeatherServiceError < StandardError
  attr_reader :status_code

  def initialize(message, status_code: 502)
    super(message)
    @status_code = status_code
  end
end

class WeatherClient
  API_URL = 'https://api.openweathermap.org/data/2.5/forecast'.freeze

  def fetch_hourly_forecast(zip_code)
    normalized = normalize_zip(zip_code)
    api_key = fetch_api_key

    uri = URI(API_URL)
    uri.query = URI.encode_www_form(zip: normalized, appid: api_key, units: 'imperial')

    response = perform_request(uri)
    parse_response(response, original_zip: zip_code)
  rescue WeatherServiceError
    raise
  rescue Timeout::Error, Errno::ECONNREFUSED, SocketError => e
    raise WeatherServiceError.new('Unable to reach weather service.', status_code: 503)
  end

  private

  def fetch_api_key
    key = ENV.fetch('OPENWEATHER_API_KEY', '').to_s.strip
    if key.blank?
      raise WeatherServiceError.new(
        'OPENWEATHER_API_KEY environment variable must be set to contact OpenWeather.',
        status_code: 500
      )
    end
    key
  end

  def normalize_zip(zip_code)
    raise ArgumentError, 'ZIP code is required.' if zip_code.blank?

    cleaned = zip_code.strip
    raise ArgumentError, 'ZIP code is required.' if cleaned.blank?

    country = 'US'
    if cleaned.include?(',')
      base, remainder = cleaned.split(',', 2)
      cleaned = base.strip
      remainder = remainder.to_s.strip
      country = remainder.upcase if remainder.present?
    end

    digits = cleaned.delete('^0-9')
    unless [5, 9].include?(digits.length)
      raise ArgumentError, 'ZIP code must include 5 or 9 digits.'
    end

    "#{digits},#{country}"
  end

  def perform_request(uri)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
      request = Net::HTTP::Get.new(uri)
      http.read_timeout = 10
      http.open_timeout = 10
      http.request(request)
    end
  end

  def parse_response(response, original_zip:)
    unless response.is_a?(Net::HTTPSuccess)
      raise build_api_error(response, original_zip: original_zip)
    end

    data = parse_json(response.body)
    unless data.is_a?(Hash) && data['list'].is_a?(Array)
      message = if data.is_a?(Hash) && data['message'].is_a?(String) && data['message'].present?
                  data['message']
                else
                  'Unknown error from weather API.'
                end
      raise WeatherServiceError.new("Weather API error: #{message}", status_code: 502)
    end

    results = data['list'].map do |entry|
      main = entry['main'].is_a?(Hash) ? entry['main'] : {}
      rain_entry = entry['rain']
      rain_amount = if rain_entry.is_a?(Hash)
                      rain_entry['3h']
                    else
                      rain_entry
                    end
      rain_amount = 0 if rain_amount.nil?

      {
        'dt' => entry['dt'],
        'temp' => main['temp'],
        'rain' => rain_amount,
        'humidity' => main['humidity']
      }
    end

    timezone_offset = 0
    if data['city'].is_a?(Hash)
      offset = data['city']['timezone']
      timezone_offset = offset.to_i if offset.respond_to?(:to_i)
    end

    [results, timezone_offset]
  end

  def parse_json(body)
    JSON.parse(body)
  rescue JSON::ParserError
    raise WeatherServiceError.new('Weather service returned invalid JSON.', status_code: 502)
  end

  def build_api_error(response, original_zip:)
    status = response.code.to_i
    payload_message = nil

    begin
      payload = JSON.parse(response.body)
      if payload.is_a?(Hash)
        message = payload['message']
        payload_message = message.to_s.strip if message.respond_to?(:to_s)
        payload_message = nil if payload_message.blank?
      end
    rescue JSON::ParserError
      payload = nil
    end

    text_detail = response.body.to_s.strip
    text_detail = nil if text_detail.blank? || text_detail == payload_message

    base_message, code = friendly_status_message(status, original_zip)
    detail = payload_message || text_detail
    if detail.present? && !base_message.include?(detail)
      WeatherServiceError.new("#{base_message} Details: #{truncate_detail(detail)}", status_code: code)
    else
      WeatherServiceError.new(base_message, status_code: code)
    end
  end

  def friendly_status_message(status, original_zip)
    case status
    when 401
      [
        'Authentication with OpenWeather failed. Verify the OPENWEATHER_API_KEY credential.',
        500
      ]
    when 404
      [
        "No forecast data found for ZIP code '#{original_zip}'. Please confirm the location.",
        400
      ]
    when 429
      [
        'OpenWeather request limit exceeded. Please wait before retrying.',
        429
      ]
    else
      ["OpenWeather API request failed with status #{status}.", 502]
    end
  end

  def truncate_detail(detail, max_length = 200)
    detail = detail.to_s.strip
    return detail if detail.length <= max_length

    detail[0, max_length - 3] + '...'
  end
end
