namespace :features do
  desc "Randomize status for all features"
  task randomize_status: :environment do
    ProjectFeature.all.each do |feature|
      feature.update!(status: ['not_started', 'work_in_progress', 'job_done'].sample)
    end
    puts "All features have been updated with random statuses!"
  end
end 