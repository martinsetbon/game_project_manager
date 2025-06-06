require 'set'

# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Clean the database
puts "Cleaning database..."
FeatureAssignment.destroy_all
ProjectFeature.destroy_all
ProjectContributor.destroy_all
Project.destroy_all
User.destroy_all
puts "Database cleaned!"

puts "Seeding users with real names..."

users = [
  { name: "Alice Nakamura", email: "alice.nakamura@example.com", job: "Artist", available: true },
  { name: "Leo Tanaka", email: "leo.tanaka@example.com", job: "Artist", available: false },

  { name: "Sophie Dubois", email: "sophie.dubois@example.com", job: "Game Designer", available: true },
  { name: "Kenta Yamada", email: "kenta.yamada@example.com", job: "Game Designer", available: true },

  { name: "Emily Chen", email: "emily.chen@example.com", job: "Programmer", available: false },
  { name: "Lucas Ito", email: "lucas.ito@example.com", job: "Programmer", available: true },

  { name: "Mia Rodriguez", email: "mia.rodriguez@example.com", job: "Sound Designer", available: true },
  { name: "Hiroshi Suzuki", email: "hiroshi.suzuki@example.com", job: "Sound Designer", available: false },
]

users.each do |user_data|
  User.create!(
    name: user_data[:name],
    email: user_data[:email],
    password: "password",
    job: user_data[:job],
    available: user_data[:available]
  )
end

puts "✅ Created #{User.count} users"

# Create a project
project = Project.create!(
  name: 'Sample Game Project',
  description: 'A sample game project with various features across different departments',
  user: User.first,
  start_date: Date.today,
  end_date: Date.new(2030, 5, 30),
  budget: 100000
)

# Add all users as contributors to the project
User.all.each do |user|
  ProjectContributor.create!(
    project: project,
    user: user
  )
end

puts "Created project: #{project.name} and added #{ProjectContributor.count} contributors"

# Game feature names by department
FEATURE_NAMES = {
  'Production' => [
    'Project Timeline',
    'Resource Management',
    'Team Communication Tools',
    'Quality Assurance Plan',
    'Release Strategy'
  ],
  'Design' => [
    'Game Mechanics Document',
    'Level Design',
    'Character Progression System',
    'Combat System',
    'Tutorial Design',
    'User Interface Design'
  ],
  'Art' => [
    'Main Character Design',
    'Enemy Character Designs',
    'Environment Concept Art',
    'Weapon Designs',
    'UI Assets',
    'Loading Screen Art'
  ],
  'Animation' => [
    'Main Character Animation',
    'Enemy Animations',
    'Environmental Animations',
    'Cutscene Animations',
    'Special Effects Animation'
  ],
  'Programming' => [
    'Core Game Loop',
    'Save System',
    'Combat Mechanics',
    'AI Behavior System',
    'Performance Optimization',
    'Bug Fixing'
  ],
  'Audio' => [
    'Main Theme Music',
    'Sound Effects Library',
    'Character Voice Acting',
    'Ambient Sound Design',
    'Combat Sound Effects',
    'Menu Sound Effects'
  ]
}

# Map departments to job titles
DEPARTMENT_TO_JOB = {
  'Production' => 'Game Designer',
  'Design' => 'Game Designer',
  'Art' => 'Artist',
  'Animation' => 'Artist',
  'Programming' => 'Programmer',
  'Audio' => 'Sound Designer'
}

puts "Creating 30 features with departments and assignments..."

# Keep track of used feature names
used_feature_names = Set.new

# Create features until we have 30 unique ones
department_start_offsets = {
  'Production' => 0, # Production starts immediately
  'Design' => 7, # Design starts after a week
  'Art' => 14, # Art starts after two weeks
  'Programming' => 21, # Programming starts after three weeks
  'Animation' => 30, # Animation starts after a month
  'Audio' => 45 # Audio starts after 1.5 months
}

department_durations = {
  'Production' => (14..45), # 2-6 weeks
  'Design' => (21..60), # 3-8 weeks
  'Art' => (14..30), # 2-4 weeks
  'Programming' => (7..30), # 1-4 weeks
  'Animation' => (5..14), # 5-14 days
  'Audio' => (3..10) # 3-10 days
}

until ProjectFeature.count == 30
  # Select random department
  department = ProjectFeature::DEPARTMENTS.sample
  
  # Get unused feature names for this department
  available_names = FEATURE_NAMES[department].reject { |name| used_feature_names.include?(name) }
  
  # If no more names available in this department, skip to next iteration
  next if available_names.empty?
  
  # Select a name we haven't used yet
  feature_name = available_names.sample
  used_feature_names.add(feature_name)
  
  # Calculate start date with department-specific offset and some randomization
  base_offset = department_start_offsets[department]
  random_offset = rand(0..15) # Add up to 15 days of random variation
  feature_start = project.start_date + base_offset.days + random_offset.days
  
  # Calculate duration based on department
  duration_range = department_durations[department]
  feature_duration = rand(duration_range).days
  feature_end = [feature_start + feature_duration, project.end_date || (project.start_date + 6.months)].min
  
  # Create the feature
  feature = ProjectFeature.create!(
    name: feature_name,
    project: project,
    department: department,
    status: %w[not_started work_in_progress job_done].sample,
    start_date: feature_start,
    end_date: feature_end
  )
  
  # Find available users for this department
  job_title = DEPARTMENT_TO_JOB[department]
  department_users = User.where(job: job_title)
  
  # Assign responsible (preferably available user)
  available_users = department_users.where(available: true)
  responsible_user = available_users.sample || department_users.sample
  
  # Assign accountable (different user if possible)
  remaining_users = department_users.where.not(id: responsible_user.id)
  accountable_user = remaining_users.sample || responsible_user
  
  # Create assignments
  FeatureAssignment.create!(
    project_feature: feature,
    user: responsible_user,
    role: 'responsible'
  )
  
  FeatureAssignment.create!(
    project_feature: feature,
    user: accountable_user,
    role: 'accountable'
  )
  
  puts "Created feature: #{feature.name} (#{feature.department})"
  puts "  → Responsible: #{responsible_user.name}"
  puts "  → Accountable: #{accountable_user.name}"
end

puts "\nSeeding completed successfully!"
puts "✅ Created #{ProjectFeature.count} features with departments and assignments!"
