class AddDepartmentToProjectFeatures < ActiveRecord::Migration[7.1]
  def change
    add_column :project_features, :department, :string
  end
end
