class AddRandomStatusToExistingFeatures < ActiveRecord::Migration[7.1]
  def up
    ProjectFeature.all.each do |feature|
      feature.update(status: ['not_started', 'work_in_progress', 'job_done'].sample)
    end
  end

  def down
    ProjectFeature.update_all(status: nil)
  end
end 