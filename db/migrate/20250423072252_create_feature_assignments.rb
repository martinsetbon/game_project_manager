class CreateFeatureAssignments < ActiveRecord::Migration[7.1]
  def change
    create_table :feature_assignments do |t|
      t.references :user, null: false, foreign_key: true
      t.references :project_feature, null: false, foreign_key: true

      t.timestamps
    end
  end
end
