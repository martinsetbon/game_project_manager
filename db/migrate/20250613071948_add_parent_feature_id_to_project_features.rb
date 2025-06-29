class AddParentFeatureIdToProjectFeatures < ActiveRecord::Migration[7.0]
  def change
    add_reference :project_features, :parent_feature, null: true, foreign_key: { to_table: :project_features }
  end
end
