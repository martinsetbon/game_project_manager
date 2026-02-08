class CreateFeatureCheckpoints < ActiveRecord::Migration[7.1]
  def change
    create_table :feature_checkpoints do |t|
      t.integer :day, null: false
      t.references :project_feature, null: false, foreign_key: true
      t.boolean :notified, default: false, null: false

      t.timestamps
    end

    add_index :feature_checkpoints, [:project_feature_id, :day], unique: true
  end
end

