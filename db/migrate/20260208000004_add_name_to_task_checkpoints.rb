class AddNameToTaskCheckpoints < ActiveRecord::Migration[7.1]
  def change
    add_column :task_checkpoints, :name, :string
  end
end

