class CreateTaskSegments < ActiveRecord::Migration[7.1]
  def change
    create_table :task_segments do |t|
      t.string :name, null: false
      t.decimal :start_day, precision: 5, scale: 1, null: false
      t.decimal :end_day, precision: 5, scale: 1, null: false
      t.references :task, null: false, foreign_key: true

      t.timestamps
    end

    add_index :task_segments, [:task_id, :start_day, :end_day]
  end
end

