class ChangeTaskSegmentDayColumnsToDecimal < ActiveRecord::Migration[7.1]
  def change
    change_column :task_segments, :start_day, :decimal, precision: 5, scale: 1
    change_column :task_segments, :end_day, :decimal, precision: 5, scale: 1
  end
end

