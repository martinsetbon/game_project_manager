class CreateTaskAssignments < ActiveRecord::Migration[7.1]
  def change
    create_table :task_assignments do |t|
      t.references :user, null: false, foreign_key: true
      t.references :task, null: false, foreign_key: true
      t.string :role, null: false # 'responsible' or 'accountable'

      t.timestamps
    end

    add_index :task_assignments, [:task_id, :user_id, :role], unique: true
    # Note: user_id and task_id indexes are automatically created by t.references
    add_index :task_assignments, :role
  end
end

