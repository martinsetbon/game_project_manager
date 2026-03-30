class AddOffsetDaysToTaskLinks < ActiveRecord::Migration[7.1]
  def change
    add_column :task_links, :offset_days, :integer, null: false, default: 0
  end
end

