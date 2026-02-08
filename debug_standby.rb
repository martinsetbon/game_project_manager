#!/usr/bin/env ruby

# Debug script to check and fix stand-by features
require_relative 'config/environment'

puts "=== Debug Stand-by Features ==="
puts "Current time: #{Time.current}"
puts "Current date: #{Date.current}"

# Find the first dungeon feature
dungeon_feature = ProjectFeature.find_by(name: 'first dungeon')

if dungeon_feature
  puts "\nFound 'first dungeon' feature:"
  puts "  Name: #{dungeon_feature.name}"
  puts "  Status: #{dungeon_feature.status}"
  puts "  Start date: #{dungeon_feature.start_date}"
  puts "  End date: #{dungeon_feature.end_date}"
  puts "  Duration: #{dungeon_feature.duration} days"
  puts "  Stand-by started at: #{dungeon_feature.stand_by_started_at}"
  
  if dungeon_feature.stand_by_started_at.present?
    days_in_stand_by = (Date.current - dungeon_feature.stand_by_started_at.to_date).to_i
    puts "  Days in stand-by: #{days_in_stand_by}"
    
    if days_in_stand_by > 0
      puts "\n--- APPLYING EXTENSION ---"
      old_end_date = dungeon_feature.end_date
      old_stand_by_started = dungeon_feature.stand_by_started_at
      
      puts "BEFORE:"
      puts "  End date: #{old_end_date}"
      puts "  Stand-by started: #{old_stand_by_started}"
      
      # Apply the extension manually
      new_end_date = old_end_date + days_in_stand_by.days
      dungeon_feature.update!(
        end_date: new_end_date,
        stand_by_started_at: Time.current
      )
      
      puts "AFTER:"
      puts "  End date: #{dungeon_feature.reload.end_date}"
      puts "  Stand-by started: #{dungeon_feature.stand_by_started_at}"
      
      days_extended = (dungeon_feature.end_date - old_end_date).to_i
      puts "  Days extended: #{days_extended}"
      puts "  Extension successful: #{days_extended > 0}"
    else
      puts "  No extension needed (0 or negative days)"
    end
  else
    puts "  No stand-by start time recorded!"
    puts "  Setting stand_by_started_at to a week ago for testing..."
    dungeon_feature.update!(stand_by_started_at: 7.days.ago)
    puts "  Stand-by started at: #{dungeon_feature.reload.stand_by_started_at}"
  end
else
  puts "Dungeon feature not found!"
  puts "Available features:"
  ProjectFeature.all.each do |f|
    puts "  - #{f.name} (Status: #{f.status})"
  end
end

puts "\n=== Debug Complete ==="
