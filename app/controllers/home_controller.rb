class HomeController < ApplicationController
  def index
    @tasks_count = Task.count
  end
end
