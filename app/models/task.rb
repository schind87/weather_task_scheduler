class Task < ApplicationRecord
  before_validation :normalize_fields

  validates :name, presence: true
  validates :duration_hours,
            numericality: { only_integer: true, greater_than: 0, allow_nil: false }
  validates :location, presence: true
  validate :location_contains_valid_zip
  validate :validate_time_strings

  scope :recent, -> { order(created_at: :desc) }

  private

  def normalize_fields
    self.name = name.to_s.strip
    self.location = location.to_s.strip
    self.earliest_start = normalize_optional_string(earliest_start)
    self.latest_start = normalize_optional_string(latest_start)
  end

  def normalize_optional_string(value)
    value = value.to_s.strip
    value.presence
  end

  def location_contains_valid_zip
    return if location.blank?

    digits = location.delete('^0-9')
    return if [5, 9].include?(digits.length)

    errors.add(:location, 'must include 5 or 9 digits for ZIP code')
  end

  def validate_time_strings
    %i[earliest_start latest_start].each do |attr|
      value = send(attr)
      next if value.blank?
      unless value.match?(/\A\d{1,2}:\d{2}\z/)
        errors.add(attr, 'must be in HH:MM format')
        next
      end
      hour, minute = value.split(':').map(&:to_i)
      if hour.negative? || hour > 23 || minute.negative? || minute > 59
        errors.add(attr, 'must be a valid time of day')
      end
    end
  end
end
