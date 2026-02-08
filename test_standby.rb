#!/usr/bin/env ruby

# Test script for stand-by feature extension
# Run this manually to test the stand-by functionality

require_relative 'config/environment'

puts "=== Testing Stand-by Feature Extension ==="
puts "Current time: #{Time.current}"
puts "Current date: #{Date.current}"

# Find the dungeon feature that should be on stand-by
dungeon_feature = ProjectFeature.find_by(name: 'first dungeon') || ProjectFeature.find_by(name: 'dungeon') || ProjectFeature.find_by(name: 'Dungeon') || ProjectFeature.find_by(name: 'First Dungeon')

if dungeon_feature
  puts "\nFound dungeon feature:"
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
      puts "  Would extend by #{days_in_stand_by} days"
      puts "  New end date would be: #{dungeon_feature.end_date + days_in_stand_by.days}"
      
      # Test the extension
      puts "\n--- Testing Extension ---"
      old_end_date = dungeon_feature.end_date
      dungeon_feature.extend_end_date_for_stand_by!
      dungeon_feature.reload
      puts "  OLD end_date: #{old_end_date}"
      puts "  NEW end_date: #{dungeon_feature.end_date}"
      puts "  Extension applied: #{dungeon_feature.end_date != old_end_date}"
    else
      puts "  No extension needed (0 or negative days)"
    end
  else
    puts "  No stand-by start time recorded!"
  end
else
  puts "\nDungeon feature not found. Listing all features:"
  ProjectFeature.all.each do |f|
    puts "  Feature: #{f.name}, Status: #{f.status}, Stand-by started: #{f.stand_by_started_at}"
  end
end

puts "\n=== Testing Extension Method Directly ==="
if dungeon_feature && dungeon_feature.status == 'stand_by'
  puts "Testing extension for 'first dungeon' feature..."
  old_end_date = dungeon_feature.end_date
  old_stand_by_started = dungeon_feature.stand_by_started_at
  
  days_in_stand_by = (Date.current - dungeon_feature.stand_by_started_at.to_date).to_i
  puts "Days in stand-by: #{days_in_stand_by}"
  
  dungeon_feature.extend_end_date_for_stand_by!
  dungeon_feature.reload
  
  puts "BEFORE extension:"
  puts "  End date: #{old_end_date}"
  puts "  Stand-by started: #{old_stand_by_started}"
  puts "AFTER extension:"
  puts "  End date: #{dungeon_feature.end_date}"
  puts "  Stand-by started: #{dungeon_feature.stand_by_started_at}"
  puts "  Extension applied: #{dungeon_feature.end_date != old_end_date}"
  puts "  Days extended: #{(dungeon_feature.end_date - old_end_date).to_i}"
else
  puts "No stand-by dungeon feature found to test"
end
