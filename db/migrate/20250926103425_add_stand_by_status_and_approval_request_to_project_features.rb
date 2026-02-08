class AddStandByStatusAndApprovalRequestToProjectFeatures < ActiveRecord::Migration[7.1]
  def change
    # Add approval request fields
    add_column :project_features, :approval_requested, :boolean, default: false
    add_column :project_features, :approval_requested_at, :datetime
    add_column :project_features, :stand_by_started_at, :datetime
    
    # Add index for performance
    add_index :project_features, :approval_requested
  end
end
