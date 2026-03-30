class AddPercentFieldsToTaskSegments < ActiveRecord::Migration[7.1]
  def change
    add_column :task_segments, :default_percent, :decimal, precision: 5, scale: 1
    add_column :task_segments, :percent_flagged, :boolean, null: false, default: false
  end
end
