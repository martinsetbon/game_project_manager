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
TaskAssignment.destroy_all
Task.destroy_all
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
  start_date: Date.new(2025, 1, 1),
  end_date: Date.new(2029, 12, 31),
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
    'Release Strategy',
    'Budget Planning',
    'Risk Assessment',
    'Stakeholder Management',
    'Project Documentation',
    'Milestone Tracking',
    'Team Performance Review',
    'Client Communication',
    'Project Retrospective',
    'Scope Management',
    'Timeline Optimization'
  ],
  'Design' => [
    'Game Mechanics Document',
    'Level Design',
    'Character Progression System',
    'Combat System',
    'Tutorial Design',
    'User Interface Design',
    'Game Balance Testing',
    'Player Experience Flow',
    'Difficulty Scaling',
    'Achievement System',
    'Quest Design',
    'Story Integration',
    'Gameplay Prototyping',
    'User Research',
    'Accessibility Features'
  ],
  'Art' => [
    'Main Character Design',
    'Enemy Character Designs',
    'Environment Concept Art',
    'Weapon Designs',
    'UI Assets',
    'Loading Screen Art',
    'Background Textures',
    'Particle Effects',
    'Icon Design',
    'Logo Creation',
    'Marketing Materials',
    'Character Animations',
    'Environmental Details',
    'Color Palette',
    'Art Style Guide'
  ],
  'Animation' => [
    'Main Character Animation',
    'Enemy Animations',
    'Environmental Animations',
    'Cutscene Animations',
    'Special Effects Animation',
    'UI Transitions',
    'Character Idle States',
    'Combat Animations',
    'Walking Cycles',
    'Facial Expressions',
    'Physics Animations',
    'Cinematic Sequences',
    'Particle Systems',
    'Lighting Effects',
    'Camera Movements'
  ],
  'Programming' => [
    'Core Game Loop',
    'Save System',
    'Combat Mechanics',
    'AI Behavior System',
    'Performance Optimization',
    'Bug Fixing',
    'Multiplayer Networking',
    'Database Integration',
    'Audio System',
    'Input Handling',
    'Memory Management',
    'Shader Programming',
    'Physics Engine',
    'Tool Development',
    'Code Documentation'
  ],
  'Audio' => [
    'Main Theme Music',
    'Sound Effects Library',
    'Character Voice Acting',
    'Ambient Sound Design',
    'Combat Sound Effects',
    'Menu Sound Effects',
    'Environmental Audio',
    'Dynamic Music System',
    'Audio Compression',
    'Voice Processing',
    '3D Audio Implementation',
    'Audio Testing',
    'Music Composition',
    'Sound Localization',
    'Audio Optimization'
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

puts "Creating 75 features with departments and assignments..."

# Keep track of used feature names
used_feature_names = Set.new

# Create features until we have 75 unique ones
department_start_offsets = {
  'Production' => 0, # Production starts immediately
  'Design' => 90, # Design starts after 3 months
  'Art' => 180, # Art starts after 6 months
  'Programming' => 270, # Programming starts after 9 months
  'Animation' => 450, # Animation starts after 15 months
  'Audio' => 630 # Audio starts after 21 months
}

department_durations = {
  'Production' => (30..120), # 1-4 months
  'Design' => (60..180), # 2-6 months
  'Art' => (30..90), # 1-3 months
  'Programming' => (14..60), # 2-8 weeks
  'Animation' => (7..30), # 1-4 weeks
  'Audio' => (5..21) # 5-21 days
}

# Create a list of all available feature names across all departments
all_feature_names = []
FEATURE_NAMES.each do |department, names|
  names.each do |name|
    all_feature_names << { department: department, name: name }
  end
end

# Shuffle the list to randomize selection
all_feature_names.shuffle!

# Create exactly 45 features with unique names
puts "Total available feature names: #{all_feature_names.length}"
(0...45).each do |i|
  # Get the next available feature
  feature_data = all_feature_names[i]
  department = feature_data[:department]
  feature_name = feature_data[:name]
  
  puts "Creating feature #{i+1}/45: #{feature_name} (#{department})"
  
  # Calculate start date with department-specific offset and some randomization
  base_offset = department_start_offsets[department]
  random_offset = rand(0..60) # Add up to 60 days of random variation
  feature_start = project.start_date + base_offset.days + random_offset.days
  
  # Calculate duration based on department
  duration_range = department_durations[department]
  feature_duration = rand(duration_range) # integer number of days
  feature_end = [feature_start + feature_duration.days, project.end_date].min
  
  # Create the feature
  feature = ProjectFeature.create!(
    name: feature_name,
    project: project,
    status: %w[not_started work_in_progress job_done].sample,
    start_date: feature_start,
    duration: feature_duration,
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
  
  puts "Created feature: #{feature.name} (#{feature.department})"
  puts "  → Responsible: #{responsible_user.name}"
  puts "  → Accountable: #{accountable_user.name}"
end

puts "\nSeeding completed successfully!"
puts "✅ Created #{ProjectFeature.count} features with departments and assignments!"

# Now create assignments for features that still exist
puts "\nCreating assignments for valid features..."
# Callbacks are already disabled in the model, no need to skip them
ProjectFeature.all.each do |feature|
  department = feature.department
  job_title = DEPARTMENT_TO_JOB[department]
  department_users = User.where(job: job_title)
  available_users = department_users.where(available: true)
  responsible_user = available_users.sample || department_users.sample
  remaining_users = department_users.where.not(id: responsible_user.id)
  accountable_user = remaining_users.sample || responsible_user
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
  puts "Assigned feature: #{feature.name} (#{feature.department})"
  puts "  → Responsible: #{responsible_user.name}"
  puts "  → Accountable: #{accountable_user.name}"
end
FeatureAssignment.set_callback(:create, :after, :adjust_dates_if_responsible)
FeatureAssignment.set_callback(:destroy, :after, :adjust_dates_if_responsible)
puts "✅ Assignments created for all valid features!"

# Create additional features specifically for Alice Nakamura
# Temporarily disabled to avoid overlap prevention issues
# puts "\nCreating 10 additional features for Alice Nakamura..."

# alice = User.find_by(name: "Alice Nakamura")
# if alice
  # Features where Alice is responsible (5 features)
  # alice_responsible_features = [
=begin
    { name: "Character Concept Art", department: "Art", duration: 14, status: "not_started" },
    { name: "Environment Textures", department: "Art", duration: 21, status: "work_in_progress" },
    { name: "UI Icon Design", department: "Art", duration: 7, status: "not_started" },
    { name: "Weapon Visual Design", department: "Art", duration: 10, status: "work_in_progress" },
    { name: "Logo and Branding", department: "Art", duration: 5, status: "job_done" }
  ]

  # Features where Alice is accountable (5 features)
  alice_accountable_features = [
    { name: "Main Character Animation", department: "Animation", duration: 21, status: "work_in_progress" },
    { name: "Combat Animations", department: "Animation", duration: 14, status: "not_started" },
    { name: "Walking Cycles", department: "Animation", duration: 10, status: "work_in_progress" },
    { name: "Facial Expressions", department: "Animation", duration: 7, status: "not_started" },
    { name: "Cutscene Animations", department: "Animation", duration: 30, status: "work_in_progress" }
  ]

  # Create features where Alice is responsible
  alice_responsible_features.each_with_index do |feature_data, index|
    begin
      # Temporarily disable overlap prevention during seeding
      ProjectFeature.class_eval do
        def prevent_overlaps_for_responsible_contributors
          # Do nothing during seeding
        end
      end
      
      feature = ProjectFeature.create!(
        name: feature_data[:name],
        project: project,
        department: feature_data[:department],
        status: feature_data[:status],
        start_date: project.start_date + (index * 15).days,
        duration: feature_data[:duration],
        end_date: project.start_date + (index * 15).days + feature_data[:duration].days
      )
    rescue => e
      puts "❌ Error creating feature '#{feature_data[:name]}': #{e.message}"
      next
    end
    
    # Assign Alice as responsible
    FeatureAssignment.create!(
      project_feature: feature,
      user: alice,
      role: 'responsible'
    )
    
    # Assign someone else as accountable (different user)
    other_user = User.where.not(id: alice.id).sample
    FeatureAssignment.create!(
      project_feature: feature,
      user: other_user,
      role: 'accountable'
    )
    
    puts "Created feature (Alice responsible): #{feature.name} (#{feature.department})"
  end

  # Create features where Alice is accountable
  alice_accountable_features.each_with_index do |feature_data, index|
    begin
      feature = ProjectFeature.create!(
        name: feature_data[:name],
        project: project,
        department: feature_data[:department],
        status: feature_data[:status],
        start_date: project.start_date + (index * 20).days + 100.days, # Start later
        duration: feature_data[:duration],
        end_date: project.start_date + (index * 20).days + 100.days + feature_data[:duration].days
      )
    rescue => e
      puts "❌ Error creating feature '#{feature_data[:name]}': #{e.message}"
      next
    end
    
    # Assign someone else as responsible
    other_user = User.where.not(id: alice.id).sample
    FeatureAssignment.create!(
      project_feature: feature,
      user: other_user,
      role: 'responsible'
    )
    
    # Assign Alice as accountable
    FeatureAssignment.create!(
      project_feature: feature,
      user: alice,
      role: 'accountable'
    )
    
    puts "Created feature (Alice accountable): #{feature.name} (#{feature.department})"
  end

#   puts "✅ Created 10 additional features for Alice Nakamura!"
#   puts "  → 5 features where Alice is responsible"
#   puts "  → 5 features where Alice is accountable"
# else
#   puts "❌ Alice Nakamura not found! Make sure the user exists."
# end
=end

# Now run overlap adjustment logic after all assignments are created
# puts "\nAligning features for responsible contributors to prevent overlaps..."
# Project.all.each do |project|
#   project.project_features.each do |feature|
#     feature.prevent_overlaps_for_responsible_contributors
#   end
# end
# puts "✅ All responsible contributors' features are now sequential with no overlaps!"
