# frozen_string_literal: true

require "time"

class AssetDebug
  ASSET_LABELS = {
    "views/home/index.html.erb" => Rails.root.join("app/views/home/index.html.erb"),
    "assets/stylesheets/application.css" => Rails.root.join("app/assets/stylesheets/application.css"),
    "javascript/main.js" => Rails.root.join("app/javascript/main.js")
  }.freeze

  def self.snapshot
    now = Time.now.utc
    assets = ASSET_LABELS.transform_values { |path| metadata_for(path, now) }
    {
      serverTime: now.iso8601,
      assets: assets
    }
  end

  def self.metadata_for(path, now)
    return missing_metadata(path) unless File.exist?(path)

    stat = File.stat(path)
    last_modified = Time.at(stat.mtime).utc
    {
      label: label_for(path),
      path: path.to_s,
      exists: true,
      lastModified: last_modified.iso8601,
      ageSeconds: [(now - last_modified).to_i, 0].max
    }
  rescue Errno::ENOENT
    missing_metadata(path)
  end
  private_class_method :metadata_for

  def self.missing_metadata(path)
    {
      label: label_for(path),
      path: path.to_s,
      exists: false
    }
  end
  private_class_method :missing_metadata

  def self.label_for(path)
    ASSET_LABELS.key(path) || path.to_s
  end
  private_class_method :label_for
end
