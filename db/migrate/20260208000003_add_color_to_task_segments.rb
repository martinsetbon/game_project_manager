class AddColorToTaskSegments < ActiveRecord::Migration[7.1]
  def change
    add_column :task_segments, :color, :string
  end
end

