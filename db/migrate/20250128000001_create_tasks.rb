class CreateTasks < ActiveRecord::Migration[7.1]
  def change
    create_table :tasks do |t|
      t.string :name, null: false
      t.text :description
      t.string :status, default: "not_started", null: false
      t.string :department
      t.date :start_date
      t.date :end_date
      t.integer :duration
      t.integer :order, default: 0 # For ordering tasks within a feature
      t.references :project_feature, null: false, foreign_key: true
      t.references :parent_task, null: true, foreign_key: { to_table: :tasks } # For subtasks
      t.references :assigned_user, null: true, foreign_key: { to_table: :users } # Direct assignment

      t.timestamps
    end

    add_index :tasks, [:project_feature_id, :name], unique: true
    # Note: parent_task_id index is automatically created by t.references
    add_index :tasks, :status
    add_index :tasks, :order
  end
end

