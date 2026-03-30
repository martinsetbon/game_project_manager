class CreateTaskCheckpoints < ActiveRecord::Migration[7.1]
  def change
    create_table :task_checkpoints do |t|
      t.integer :day, null: false
      t.references :task, null: false, foreign_key: true
      t.boolean :notified, default: false, null: false

      t.timestamps
    end

    add_index :task_checkpoints, [:task_id, :day], unique: true
  end
end

