#!/usr/bin/env ruby

# Test script to manually create a notification
# This will help us debug the notification system

puts "Testing notification creation..."

# Find the user
user = User.find_by(email: "permission-test-contributor1@exemple.com")
if user.nil?
  puts "❌ User not found: permission-test-contributor1@exemple.com"
  exit 1
end

puts "✅ Found user: #{user.email} (ID: #{user.id})"

# Find a project and feature
project = user.contributed_projects.first
if project.nil?
  puts "❌ No contributed projects found for user"
  exit 1
end

feature = project.project_features.first
if feature.nil?
  puts "❌ No features found in project #{project.name}"
  exit 1
end

puts "✅ Found project: #{project.name} (ID: #{project.id})"
puts "✅ Found feature: #{feature.name} (ID: #{feature.id})"

# Create a test notification
begin
  notification = Notification.create_for_feature_assignment(feature, user, 'responsible')
  puts "✅ Notification created successfully: #{notification.id}"
  puts "   Title: #{notification.title}"
  puts "   Message: #{notification.message}"
  puts "   Type: #{notification.notification_type}"
rescue => e
  puts "❌ Failed to create notification: #{e.message}"
  puts e.backtrace.first(5).join("\n")
end

# Check if notification exists in database
count = user.notifications.count
puts "📊 Total notifications for user: #{count}"

if count > 0
  puts "📋 Recent notifications:"
  user.notifications.recent.limit(5).each do |notif|
    puts "  - #{notif.notification_type}: #{notif.title} (#{notif.created_at})"
  end
end
