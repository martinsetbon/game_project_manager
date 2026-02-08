# Simple seeds file just for Alice Nakamura's features
# Run with: rails runner db/seeds_alice.rb

puts "Creating features for Alice Nakamura..."

# Find Alice and the first project
alice = User.find_by(name: "Alice Nakamura")
project = Project.first

if alice.nil?
  puts "❌ Alice Nakamura not found! Creating her first..."
  alice = User.create!(
    name: "Alice Nakamura",
    email: "alice.nakamura@example.com",
    password: "password",
    job: "Artist",
    available: true
  )
  puts "✅ Created Alice Nakamura"
end

if project.nil?
  puts "❌ No project found! Creating one first..."
  project = Project.create!(
    name: 'Sample Game Project',
    description: 'A sample game project for testing',
    user: alice,
    start_date: Date.new(2025, 1, 1),
    end_date: Date.new(2029, 12, 31),
    budget: 100000
  )
  puts "✅ Created project: #{project.name}"
end

# Make sure Alice is a contributor to the project
unless project.project_contributors.exists?(user: alice)
  ProjectContributor.create!(project: project, user: alice)
  puts "✅ Added Alice as project contributor"
end

# Features where Alice is responsible (5 features)
alice_responsible_features = [
  { name: "Character Concept Art", department: "Art", duration: 14, status: "not_started" },
  { name: "Environment Textures", department: "Art", duration: 21, status: "work_in_progress" },
  { name: "UI Icon Design", department: "Art", duration: 7, status: "not_started" },
  { name: "Weapon Visual Design", department: "Art", duration: 10, status: "work_in_progress" },
  { name: "Logo and Branding", department: "Art", duration: 5, status: "job_done" }
]

puts "\nCreating features where Alice is responsible..."

alice_responsible_features.each_with_index do |feature_data, index|
  # Check if feature already exists
  existing_feature = project.project_features.find_by(name: feature_data[:name])
  if existing_feature
    puts "⚠️  Feature '#{feature_data[:name]}' already exists, skipping..."
    next
  end

  begin
    # Temporarily disable callbacks that might delete the feature
    FeatureAssignment.skip_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.skip_callback(:destroy, :after, :adjust_dates_if_responsible)
    
    feature = ProjectFeature.create!(
      name: feature_data[:name],
      project: project,
      department: feature_data[:department],
      status: feature_data[:status],
      start_date: project.start_date + (index * 15).days,
      duration: feature_data[:duration],
      end_date: project.start_date + (index * 15).days + feature_data[:duration].days
    )
    
    # Check if feature still exists after creation
    if feature.persisted?
      # Assign Alice as responsible
      FeatureAssignment.create!(
        project_feature: feature,
        user: alice,
        role: 'responsible'
      )
      
      # Assign someone else as accountable (or Alice if no one else)
      other_user = User.where.not(id: alice.id).first || alice
      FeatureAssignment.create!(
        project_feature: feature,
        user: other_user,
        role: 'accountable'
      )
      
      puts "✅ Created feature (Alice responsible): #{feature.name} (#{feature.department})"
    else
      puts "❌ Feature was deleted after creation: #{feature_data[:name]}"
    end
    
    # Re-enable callbacks
    FeatureAssignment.set_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.set_callback(:destroy, :after, :adjust_dates_if_responsible)
    
  rescue => e
    puts "❌ Error creating feature '#{feature_data[:name]}': #{e.message}"
    # Re-enable callbacks in case of error
    FeatureAssignment.set_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.set_callback(:destroy, :after, :adjust_dates_if_responsible)
  end
end

# Features where Alice is accountable (5 features)
alice_accountable_features = [
  { name: "Main Character Animation", department: "Animation", duration: 21, status: "work_in_progress" },
  { name: "Combat Animations", department: "Animation", duration: 14, status: "not_started" },
  { name: "Walking Cycles", department: "Animation", duration: 10, status: "work_in_progress" },
  { name: "Facial Expressions", department: "Animation", duration: 7, status: "not_started" },
  { name: "Cutscene Animations", department: "Animation", duration: 30, status: "work_in_progress" }
]

puts "\nCreating features where Alice is accountable..."

alice_accountable_features.each_with_index do |feature_data, index|
  # Check if feature already exists
  existing_feature = project.project_features.find_by(name: feature_data[:name])
  if existing_feature
    puts "⚠️  Feature '#{feature_data[:name]}' already exists, skipping..."
    next
  end

  begin
    # Temporarily disable callbacks that might delete the feature
    FeatureAssignment.skip_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.skip_callback(:destroy, :after, :adjust_dates_if_responsible)
    
    feature = ProjectFeature.create!(
      name: feature_data[:name],
      project: project,
      department: feature_data[:department],
      status: feature_data[:status],
      start_date: project.start_date + (index * 20).days + 200.days, # Start later to avoid conflicts
      duration: feature_data[:duration],
      end_date: project.start_date + (index * 20).days + 200.days + feature_data[:duration].days
    )
    
    # Check if feature still exists after creation
    if feature.persisted?
      # Assign someone else as responsible (or Alice if no one else)
      other_user = User.where.not(id: alice.id).first || alice
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
      
      puts "✅ Created feature (Alice accountable): #{feature.name} (#{feature.department})"
    else
      puts "❌ Feature was deleted after creation: #{feature_data[:name]}"
    end
    
    # Re-enable callbacks
    FeatureAssignment.set_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.set_callback(:destroy, :after, :adjust_dates_if_responsible)
    
  rescue => e
    puts "❌ Error creating feature '#{feature_data[:name]}': #{e.message}"
    # Re-enable callbacks in case of error
    FeatureAssignment.set_callback(:create, :after, :adjust_dates_if_responsible)
    FeatureAssignment.set_callback(:destroy, :after, :adjust_dates_if_responsible)
  end
end

puts "\n✅ Done! Alice should now have features assigned to her."
puts "Total features in project: #{project.project_features.count}"
puts "Features where Alice is responsible: #{alice.responsible_features.count}"
puts "Features where Alice is accountable: #{alice.accountable_features.count}"
