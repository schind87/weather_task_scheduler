class CreateTasks < ActiveRecord::Migration[7.1]
  def change
    create_table :tasks do |t|
      t.string :name, null: false
      t.integer :duration_hours, null: false
      t.float :min_temp
      t.float :max_temp
      t.integer :min_humidity
      t.integer :max_humidity
      t.boolean :no_rain, null: false, default: true
      t.string :location, null: false
      t.datetime :scheduled_time
      t.string :earliest_start
      t.string :latest_start

      t.timestamps
    end

    add_index :tasks, :name
  end
end
