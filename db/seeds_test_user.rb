# Script to create test data for "project manager test 1" user
# Run with: rails runner db/seeds_test_user.rb

puts "Creating test data for 'project manager test 1'..."

# Find or create the user
test_user = User.find_by(email: "project.manager.test1@example.com") || 
            User.find_by(name: "project manager test 1")

if test_user.nil?
  puts "Creating user 'project manager test 1'..."
  test_user = User.create!(
    name: "project manager test 1",
    email: "project.manager.test1@example.com",
    password: "password",
    job: "Project Manager",
    available: true
  )
  puts "✅ Created user: #{test_user.name}"
else
  puts "✅ Found user: #{test_user.name}"
end

# Create a project for the test user
project = test_user.projects.find_or_create_by!(name: "Epic Adventure Game") do |p|
  p.description = "A fantasy RPG adventure game with multiple features"
  p.start_date = Date.current - 30.days
  p.end_date = Date.current + 180.days
  p.budget = 500000
  p.status = "active"
end

puts "✅ Project: #{project.name}"

# Get some other users to assign as contributors
other_users = User.where.not(id: test_user.id).limit(5)
if other_users.count < 3
  puts "Creating additional users for assignments..."
  ["Alice Artist", "Bob Programmer", "Charlie Designer"].each do |name|
    User.find_or_create_by!(email: "#{name.downcase.gsub(' ', '.')}@example.com") do |u|
      u.name = name
      u.password = "password"
      u.job = name.split.last
      u.available = true
    end
  end
  other_users = User.where.not(id: test_user.id).limit(5)
end

# Create features with various statuses and dates for dashboard testing

# 1. Overdue feature (needs attention NOW)
overdue_feature = project.project_features.find_or_create_by!(name: "Main Menu UI Design") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 20.days
  f.end_date = Date.current - 5.days
  f.duration = 15
end

# Assign test user as responsible for overdue feature
unless overdue_feature.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: overdue_feature,
    user: test_user,
    role: 'responsible'
  )
end

# 2. Feature ending today (urgent)
ending_today = project.project_features.find_or_create_by!(name: "Character Animation System") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 10.days
  f.end_date = Date.current
  f.duration = 10
end

unless ending_today.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: ending_today,
    user: test_user,
    role: 'responsible'
  )
end

# 3. Feature ending tomorrow
ending_tomorrow = project.project_features.find_or_create_by!(name: "Sound Effects Library") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 8.days
  f.end_date = Date.current + 1.day
  f.duration = 9
end

unless ending_tomorrow.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: ending_tomorrow,
    user: test_user,
    role: 'responsible'
  )
end

# 4. Feature ending in 2 days
ending_soon = project.project_features.find_or_create_by!(name: "Combat System Programming") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 5.days
  f.end_date = Date.current + 2.days
  f.duration = 7
end

unless ending_soon.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: ending_soon,
    user: test_user,
    role: 'responsible'
  )
end

# 5. Approval request (urgent - needs approval NOW)
approval_feature = project.project_features.find_or_create_by!(name: "Level 1 Environment Art") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 15.days
  f.end_date = Date.current + 5.days
  f.duration = 20
  f.approval_requested = true
  f.approval_requested_at = Time.current - 2.days
end

# Assign test user as accountable (needs to approve)
unless approval_feature.feature_assignments.exists?(user: test_user, role: 'accountable')
  FeatureAssignment.create!(
    project_feature: approval_feature,
    user: test_user,
    role: 'accountable'
  )
end

# Assign another user as responsible
responsible_user = other_users.first
unless approval_feature.feature_assignments.exists?(user: responsible_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: approval_feature,
    user: responsible_user,
    role: 'responsible'
  )
end

# 6. Another approval request
approval_feature2 = project.project_features.find_or_create_by!(name: "Player Movement System") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 12.days
  f.end_date = Date.current + 3.days
  f.duration = 15
  f.approval_requested = true
  f.approval_requested_at = Time.current - 1.day
end

unless approval_feature2.feature_assignments.exists?(user: test_user, role: 'accountable')
  FeatureAssignment.create!(
    project_feature: approval_feature2,
    user: test_user,
    role: 'accountable'
  )
end

# 7. Feature starting today
starting_today = project.project_features.find_or_create_by!(name: "Inventory System Design") do |f|
  f.status = "not_started"
  f.start_date = Date.current
  f.end_date = Date.current + 14.days
  f.duration = 14
end

unless starting_today.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: starting_today,
    user: test_user,
    role: 'responsible'
  )
end

# 8. Feature starting tomorrow
starting_tomorrow = project.project_features.find_or_create_by!(name: "Boss Battle Music") do |f|
  f.status = "not_started"
  f.start_date = Date.current + 1.day
  f.end_date = Date.current + 8.days
  f.duration = 7
end

unless starting_tomorrow.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: starting_tomorrow,
    user: test_user,
    role: 'responsible'
  )
end

# 9. Feature starting in 3 days
starting_soon = project.project_features.find_or_create_by!(name: "UI Animation Effects") do |f|
  f.status = "not_started"
  f.start_date = Date.current + 3.days
  f.end_date = Date.current + 10.days
  f.duration = 7
end

unless starting_soon.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: starting_soon,
    user: test_user,
    role: 'responsible'
  )
end

# 10. Feature starting in 1 week
starting_later = project.project_features.find_or_create_by!(name: "Save System Implementation") do |f|
  f.status = "not_started"
  f.start_date = Date.current + 7.days
  f.end_date = Date.current + 21.days
  f.duration = 14
end

unless starting_later.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: starting_later,
    user: test_user,
    role: 'responsible'
  )
end

# 11. Feature starting in 2 weeks
starting_future = project.project_features.find_or_create_by!(name: "Marketing Art Assets") do |f|
  f.status = "not_started"
  f.start_date = Date.current + 14.days
  f.end_date = Date.current + 28.days
  f.duration = 14
end

unless starting_future.feature_assignments.exists?(user: test_user, role: 'responsible')
  FeatureAssignment.create!(
    project_feature: starting_future,
    user: test_user,
    role: 'responsible'
  )
end

# Create checkpoints for features where test user is accountable
# Checkpoint needed today
checkpoint_feature1 = project.project_features.find_or_create_by!(name: "Quest System Design") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 5.days
  f.end_date = Date.current + 10.days
  f.duration = 15
end

# Assign test user as accountable
unless checkpoint_feature1.feature_assignments.exists?(user: test_user, role: 'accountable')
  FeatureAssignment.create!(
    project_feature: checkpoint_feature1,
    user: test_user,
    role: 'accountable'
  )
end

# Create checkpoint for day 6 (today is day 6, so checkpoint is today)
checkpoint1 = checkpoint_feature1.feature_checkpoints.find_or_create_by!(day: 6) do |cp|
  cp.notified = false
end

# Checkpoint needed tomorrow
checkpoint_feature2 = project.project_features.find_or_create_by!(name: "Enemy AI Programming") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 4.days
  f.end_date = Date.current + 11.days
  f.duration = 15
end

unless checkpoint_feature2.feature_assignments.exists?(user: test_user, role: 'accountable')
  FeatureAssignment.create!(
    project_feature: checkpoint_feature2,
    user: test_user,
    role: 'accountable'
  )
end

# Create checkpoint for day 6 (tomorrow)
checkpoint2 = checkpoint_feature2.feature_checkpoints.find_or_create_by!(day: 6) do |cp|
  cp.notified = false
end

# Checkpoint in 3 days
checkpoint_feature3 = project.project_features.find_or_create_by!(name: "Character Voice Acting") do |f|
  f.status = "work_in_progress"
  f.start_date = Date.current - 2.days
  f.end_date = Date.current + 13.days
  f.duration = 15
end

unless checkpoint_feature3.feature_assignments.exists?(user: test_user, role: 'accountable')
  FeatureAssignment.create!(
    project_feature: checkpoint_feature3,
    user: test_user,
    role: 'accountable'
  )
end

# Create checkpoint for day 5 (in 3 days)
checkpoint3 = checkpoint_feature3.feature_checkpoints.find_or_create_by!(day: 5) do |cp|
  cp.notified = false
end

# Create some notifications
puts "\nCreating notifications..."

# High priority notification
Notification.find_or_create_by!(
  user: test_user,
  project: project,
  notification_type: 'feature_overdue'
) do |n|
  n.project_feature = overdue_feature
  n.title = "Overdue feature"
  n.message = "You are responsible for overdue feature 'Main Menu UI Design' in #{project.name}"
  n.priority = 'high'
  n.read = false
  n.viewed = false
end

# Another high priority notification
Notification.find_or_create_by!(
  user: test_user,
  project: project,
  notification_type: 'approval_requested',
  project_feature: approval_feature
) do |n|
  n.title = "Approval requested"
  n.message = "Approval requested for 'Level 1 Environment Art' in #{project.name}"
  n.priority = 'high'
  n.read = false
  n.viewed = false
end

# Normal priority notification
Notification.find_or_create_by!(
  user: test_user,
  project: project,
  notification_type: 'feature_assigned',
  project_feature: starting_today
) do |n|
  n.title = "Feature assigned to you"
  n.message = "You are responsible for 'Inventory System Design' in #{project.name}"
  n.priority = 'normal'
  n.read = false
  n.viewed = false
end

puts "\n✅ Test data created successfully!"
puts "   - User: #{test_user.name}"
puts "   - Project: #{project.name}"
puts "   - Features created: #{project.project_features.count}"
puts "   - Assignments: #{test_user.feature_assignments.count}"
puts "   - Checkpoints: #{FeatureCheckpoint.joins(project_feature: :feature_assignments).where(feature_assignments: { user_id: test_user.id }).count}"
puts "   - Notifications: #{test_user.notifications.count}"
puts "\nYou can now log in as '#{test_user.email}' with password 'password' to see the dashboard!"

