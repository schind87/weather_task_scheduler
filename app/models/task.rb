class Task < ApplicationRecord
  before_validation :normalize_location
  before_validation :normalize_time_fields
  before_validation :normalize_optional_numbers

  validates :name, presence: true
  validates :duration_hours,
            numericality: { only_integer: true, greater_than: 0 }
  validates :location, presence: true
  validates :no_rain, inclusion: { in: [true, false] }

  validate :location_must_be_valid_zip
  validate :temperature_range_is_sane
  validate :humidity_range_is_sane
  validate :time_fields_are_valid

  private

  def normalize_location
    self.location = location.to_s.strip.presence
  end

  def normalize_time_fields
    %i[earliest_start latest_start].each do |attr|
      value = self[attr]
      if value.is_a?(String)
        trimmed = value.strip
        if trimmed.empty?
          self[attr] = nil
          next
        end
        if trimmed.match?(/\A\d{1,2}:\d{2}\z/)
          hour, minute = trimmed.split(":").map(&:to_i)
          if hour.between?(0, 23) && minute.between?(0, 59)
            self[attr] = format("%02d:%02d", hour, minute)
            next
          end
        end
        self[attr] = trimmed
      elsif value.blank?
        self[attr] = nil
      end
    end
  end

  def normalize_optional_numbers
    self.min_temp = nil if min_temp.blank?
    self.max_temp = nil if max_temp.blank?
    self.min_humidity = nil if min_humidity.blank?
    self.max_humidity = nil if max_humidity.blank?
  end

  def location_must_be_valid_zip
    return if location.blank?

    base, country = location.split(",", 2).map { |part| part.strip }
    digits = base.gsub(/\D/, "")
    unless [5, 9].include?(digits.length)
      errors.add(:location, "must include 5 or 9 digits.")
    end

    if country.present? && !country.match?(/\A[A-Za-z]{2}\z/)
      errors.add(:location, "country code must be two letters if provided.")
    end
  end

  def temperature_range_is_sane
    return if min_temp.blank? || max_temp.blank?

    if min_temp > max_temp
      errors.add(:max_temp, "must be greater than or equal to minimum temperature.")
    end
  end

  def humidity_range_is_sane
    if min_humidity.present?
      unless min_humidity.is_a?(Numeric) && min_humidity.between?(0, 100)
        errors.add(:min_humidity, "must be between 0 and 100.")
      end
    end

    if max_humidity.present?
      unless max_humidity.is_a?(Numeric) && max_humidity.between?(0, 100)
        errors.add(:max_humidity, "must be between 0 and 100.")
      end
    end

    return if min_humidity.blank? || max_humidity.blank?

    if min_humidity > max_humidity
      errors.add(:max_humidity, "must be greater than or equal to minimum humidity.")
    end
  end

  def time_fields_are_valid
    %i[earliest_start latest_start].each do |attr|
      value = self[attr]
      next if value.blank?

      unless value.is_a?(String) && value.match?(/\A\d{2}:\d{2}\z/)
        errors.add(attr, "must be in HH:MM format.")
        next
      end

      hour, minute = value.split(":").map(&:to_i)
      unless hour.between?(0, 23) && minute.between?(0, 59)
        errors.add(attr, "must be a valid 24-hour time.")
      end
    end
  end
end
