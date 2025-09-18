ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "minitest/mock"

module ActiveSupport
  class TestCase
    # Running the API tests sequentially keeps stubbing simple.
    parallelize(workers: 1)
  end
end
