class SetDefaultStatusForProjects < ActiveRecord::Migration[7.0]
  def up
    # Update any nil status values to 'not_started'
    Project.where(status: nil).update_all(status: 'not_started')
  end

  def down
    # No need for down migration as we're setting a default value
  end
end
