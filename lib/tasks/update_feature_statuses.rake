namespace :features do
  desc "Update all feature statuses based on their start and end dates"
  task update_statuses: :environment do
    puts "Updating feature statuses based on dates..."
    
    updated_count = 0
    ProjectFeature.find_each do |feature|
      old_status = feature.status
      new_status = feature.calculate_status
      
      if old_status != new_status
        feature.update_column(:status, new_status)
        puts "Feature '#{feature.name}' status changed from '#{old_status}' to '#{new_status}'"
        updated_count += 1
      end
    end
    
    puts "Updated #{updated_count} features with new statuses based on their dates."
    puts "Total features processed: #{ProjectFeature.count}"
  end

  desc "Show current status distribution"
  task status_summary: :environment do
    puts "Current feature status distribution:"
    ProjectFeature.group(:status).count.each do |status, count|
      puts "  #{status}: #{count} features"
    end
    
    puts "\nFeatures by date status:"
    today = Date.current
    not_started = ProjectFeature.where('start_date > ?', today).count
    in_progress = ProjectFeature.where('start_date <= ? AND end_date >= ?', today, today).count
    completed = ProjectFeature.where('end_date < ?', today).count
    no_dates = ProjectFeature.where('start_date IS NULL OR end_date IS NULL').count
    
    puts "  Not started (future dates): #{not_started}"
    puts "  In progress (current period): #{in_progress}"
    puts "  Completed (past dates): #{completed}"
    puts "  No dates set: #{no_dates}"
  end
end
