class AddBacklogFieldsToTasks < ActiveRecord::Migration[7.1]
  def change
    add_column :tasks, :backlog_type, :string
    add_column :tasks, :backlog_user_id, :bigint
    add_column :tasks, :project_id, :bigint
    
    add_index :tasks, :backlog_type
    add_index :tasks, :backlog_user_id
    add_index :tasks, :project_id
    
    # Make project_feature_id optional for backlog tasks
    change_column_null :tasks, :project_feature_id, true
    
    # Add foreign keys
    add_foreign_key :tasks, :users, column: :backlog_user_id
    add_foreign_key :tasks, :projects, column: :project_id
  end
end

