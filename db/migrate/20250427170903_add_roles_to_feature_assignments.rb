class AddRolesToFeatureAssignments < ActiveRecord::Migration[7.1]
  def change
    add_column :feature_assignments, :role, :string, null: false, default: 'responsible'
    add_column :project_features, :status, :string, null: false, default: 'not_started'
  end
end
