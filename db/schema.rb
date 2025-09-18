# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2025_09_18_000823) do
  create_table "tasks", force: :cascade do |t|
    t.string "name", null: false
    t.integer "duration_hours", null: false
    t.float "min_temp"
    t.float "max_temp"
    t.integer "min_humidity"
    t.integer "max_humidity"
    t.boolean "no_rain", default: true, null: false
    t.string "location", null: false
    t.datetime "scheduled_time"
    t.string "earliest_start"
    t.string "latest_start"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tasks_on_name"
  end

end
