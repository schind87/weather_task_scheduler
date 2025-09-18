# frozen_string_literal: true

class HomeController < ApplicationController
  def index
    @asset_debug = AssetDebug.snapshot
  end
end
