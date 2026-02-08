class RemovePriorityAndDepartmentFromFeatureTemplates < ActiveRecord::Migration[7.1]
  def up
    remove_column :feature_templates, :department, :string if column_exists?(:feature_templates, :department)
    remove_column :feature_templates, :priority, :string if column_exists?(:feature_templates, :priority)
  end

  def down
    add_column :feature_templates, :department, :string unless column_exists?(:feature_templates, :department)
    add_column :feature_templates, :priority, :string, default: 'high' unless column_exists?(:feature_templates, :priority)
  end
end

