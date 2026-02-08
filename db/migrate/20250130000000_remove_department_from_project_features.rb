class RemoveDepartmentFromProjectFeatures < ActiveRecord::Migration[7.0]
  def change
    remove_column :project_features, :department, :string
  end
end

