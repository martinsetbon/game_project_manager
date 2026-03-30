class CreateTaskLinks < ActiveRecord::Migration[7.1]
  def change
    create_table :task_links do |t|
      t.references :source_task, null: false, foreign_key: { to_table: :tasks }
      t.references :target_task, null: false, foreign_key: { to_table: :tasks }
      t.integer :anchor_day, null: false
      t.integer :offset_days, null: false, default: 0

      t.timestamps
    end

    add_index :task_links, [:source_task_id, :target_task_id], unique: true unless index_exists?(:task_links, [:source_task_id, :target_task_id])
    add_index :task_links, [:target_task_id], unique: true unless index_exists?(:task_links, [:target_task_id])
  end
end

