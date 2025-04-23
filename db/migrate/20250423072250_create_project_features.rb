class CreateProjectFeatures < ActiveRecord::Migration[7.1]
  def change
    create_table :project_features do |t|
      t.string :name
      t.integer :duration
      t.references :project, null: false, foreign_key: true

      t.timestamps
    end
  end
end
