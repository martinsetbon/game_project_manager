class CreateFeatureTemplates < ActiveRecord::Migration[7.1]
  def change
    create_table :feature_templates do |t|
      t.string :name
      t.string :department
      t.references :user, null: false, foreign_key: true
      t.text :tasks_data

      t.timestamps
    end
  end
end
