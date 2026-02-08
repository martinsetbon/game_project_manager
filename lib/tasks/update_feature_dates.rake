namespace :features do
  desc "Update all feature dates to spread across 2025-2029"
  task update_dates: :environment do
    puts "Updating feature dates to spread across 2025-2029..."
    
    # Update project dates first
    projects = Project.all
    projects.each do |project|
      project.update!(
        start_date: Date.new(2025, 1, 1),
        end_date: Date.new(2029, 12, 31)
      )
      puts "Updated project '#{project.name}' dates: #{project.start_date} to #{project.end_date}"
    end
    
    # Department start offsets (in days from project start)
    department_start_offsets = {
      'Production' => 0,    # Production starts immediately
      'Design' => 90,       # Design starts after 3 months
      'Art' => 180,         # Art starts after 6 months
      'Programming' => 270, # Programming starts after 9 months
      'Animation' => 450,   # Animation starts after 15 months
      'Audio' => 630        # Audio starts after 21 months
    }
    
    # Department duration ranges (in days)
    department_durations = {
      'Production' => (30..120),  # 1-4 months
      'Design' => (60..180),      # 2-6 months
      'Art' => (30..90),          # 1-3 months
      'Programming' => (14..60),  # 2-8 weeks
      'Animation' => (7..30),     # 1-4 weeks
      'Audio' => (5..21)          # 5-21 days
    }
    
    # Get all features grouped by project
    Project.all.each do |project|
      puts "\nProcessing project: #{project.name}"
      
      # Group features by department
      features_by_department = project.project_features.group_by(&:department)
      
      features_by_department.each do |department, features|
        puts "  Processing #{features.count} #{department} features..."
        
        # Calculate base start date for this department
        base_offset = department_start_offsets[department] || 0
        base_start_date = project.start_date + base_offset.days
        
        # Shuffle features to randomize their order within the department
        features.shuffle.each_with_index do |feature, index|
          # Add random offset (up to 60 days) and index-based spacing
          random_offset = rand(0..60)
          index_spacing = index * 7 # 1 week spacing between features
          
          feature_start = base_start_date + random_offset.days + index_spacing.days
          
          # Calculate duration based on department
          duration_range = department_durations[department] || (14..30)
          feature_duration = rand(duration_range)
          
          # Calculate end date, ensuring it doesn't exceed project end date
          feature_end = [feature_start + feature_duration.days, project.end_date].min
          
          # Update the feature
          feature.update!(
            start_date: feature_start,
            end_date: feature_end,
            duration: feature_duration
          )
          
          puts "    Updated '#{feature.name}': #{feature.start_date} to #{feature.end_date} (#{feature_duration} days)"
        end
      end
    end
    
    puts "\n✅ Successfully updated all feature dates!"
    puts "Features now span from 2025 to 2029"
  end
end
