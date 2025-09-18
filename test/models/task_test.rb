require "test_helper"

class TaskTest < ActiveSupport::TestCase
  test "valid task passes validation" do
    task = Task.new(
      name: "Test Task",
      duration_hours: 3,
      location: "97201",
      min_temp: 50.0,
      max_temp: 80.0,
      earliest_start: "08:00",
      latest_start: "17:00"
    )

    assert_predicate task, :valid?
  end

  test "location requires 5 or 9 digit zip" do
    task = Task.new(name: "Task", duration_hours: 2, location: "abc")

    assert_not task.valid?
    assert_includes task.errors[:location], "must include 5 or 9 digits for ZIP code"
  end

  test "time strings must follow hh:mm" do
    task = Task.new(name: "Task", duration_hours: 2, location: "97201", earliest_start: "25:99")

    assert_not task.valid?
    assert_includes task.errors[:earliest_start], "must be a valid time of day"
  end
end
