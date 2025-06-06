class AddDatesToProjectFeatures < ActiveRecord::Migration[7.1]
  def change
    add_column :project_features, :start_date, :date
    add_column :project_features, :end_date, :date
  end
end
