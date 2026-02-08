class CreateFeatureSegments < ActiveRecord::Migration[7.1]
  def change
    create_table :feature_segments do |t|
      t.string :name, null: false
      t.integer :start_day, null: false
      t.integer :end_day, null: false
      t.references :project_feature, null: false, foreign_key: true

      t.timestamps
    end

    add_index :feature_segments, [:project_feature_id, :start_day, :end_day]
  end
end

