namespace :features do
  desc "Extend end dates for features in stand by status"
  task extend_stand_by: :environment do
    begin
      puts "=== Stand-by Feature Extension Task Started ==="
      puts "Current time: #{Time.current}"
      puts "Current date: #{Date.current}"
      puts "Rails environment: #{Rails.env}"
      
      # Log to file for debugging
      log_file = Rails.root.join('log', 'stand_by_extension.log')
      File.open(log_file, 'a') do |f|
        f.puts "#{Time.current} - Starting stand-by extension task"
      end
      
      stand_by_features = ProjectFeature.where(status: 'stand_by')
                                        .where.not(stand_by_started_at: nil)
      
      puts "Found #{stand_by_features.count} features in stand-by status"
      
      if stand_by_features.count == 0
        puts "No stand-by features found. Checking all features..."
        all_features = ProjectFeature.all
        puts "Total features: #{all_features.count}"
        all_features.each do |f|
          puts "  Feature: #{f.name}, Status: #{f.status}, Stand-by started: #{f.stand_by_started_at}"
        end
      end
      
      stand_by_features.find_each do |feature|
        puts "\nProcessing feature: #{feature.name} (ID: #{feature.id})"
        puts "  Current end_date: #{feature.end_date}"
        puts "  Stand-by started at: #{feature.stand_by_started_at}"
        
        days_in_stand_by = (Date.current - feature.stand_by_started_at.to_date).to_i
        puts "  Days in stand-by: #{days_in_stand_by}"
        
        if days_in_stand_by > 0
          old_end_date = feature.end_date
          feature.extend_end_date_for_stand_by!
          feature.reload
          puts "  OLD end_date: #{old_end_date}"
          puts "  NEW end_date: #{feature.end_date}"
          puts "  Extension applied: #{feature.end_date != old_end_date}"
          
          # Log to file
          File.open(log_file, 'a') do |f|
            f.puts "  Extended feature '#{feature.name}' by #{days_in_stand_by} days. Old: #{old_end_date}, New: #{feature.end_date}"
          end
        else
          puts "  No extension needed (0 or negative days)"
        end
      end
      
      puts "\nExtended end dates for #{stand_by_features.count} stand-by features"
      
      # Log completion
      File.open(log_file, 'a') do |f|
        f.puts "#{Time.current} - Completed stand-by extension task. Processed #{stand_by_features.count} features"
      end
      
    rescue => e
      puts "ERROR in stand-by extension task: #{e.message}"
      puts e.backtrace.join("\n")
      
      # Log error to file
      log_file = Rails.root.join('log', 'stand_by_extension.log')
      File.open(log_file, 'a') do |f|
        f.puts "#{Time.current} - ERROR: #{e.message}"
        f.puts e.backtrace.join("\n")
      end
      
      raise e
    end
  end
end
