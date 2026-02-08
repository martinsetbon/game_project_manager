#!/usr/bin/env ruby
# List all tasks with details

require_relative 'config/environment'

puts "=" * 80
puts "ALL TASKS IN DATABASE"
puts "=" * 80
puts

tasks = Task.all.includes(:responsible_users, :accountable_users, :project, :project_feature)

if tasks.empty?
  puts "No tasks found in the database."
else
  tasks.each_with_index do |task, index|
    puts "Task ##{index + 1}"
    puts "-" * 80
    puts "ID: #{task.id}"
    puts "Name: #{task.name}"
    puts "Description: #{task.description || 'N/A'}"
    puts "Duration: #{task.duration || 'N/A'} days"
    puts "Status: #{task.status}"
    puts "Department: #{task.department || 'N/A'}"
    puts "Backlog Type: #{task.backlog_type || 'None (regular task)'}"
    puts "Project ID: #{task.project_id || 'N/A'}"
    puts "Project Name: #{task.project&.name || 'N/A'}"
    puts "Backlog User ID: #{task.backlog_user_id || 'N/A'}"
    puts "Backlog User: #{task.backlog_user&.name || 'N/A'}"
    puts "Project Feature ID: #{task.project_feature_id || 'N/A'}"
    puts "Project Feature: #{task.project_feature&.name || 'N/A'}"
    puts "Start Date: #{task.start_date || 'N/A'}"
    puts "End Date: #{task.end_date || 'N/A'}"
    puts "Responsible Users: #{task.responsible_users.map(&:name).join(', ') || 'None'}"
    puts "Accountable Users: #{task.accountable_users.map(&:name).join(', ') || 'None'}"
    puts "Created At: #{task.created_at}"
    puts "Updated At: #{task.updated_at}"
    puts "=" * 80
    puts
  end
  
  puts "Total tasks: #{tasks.count}"
end

