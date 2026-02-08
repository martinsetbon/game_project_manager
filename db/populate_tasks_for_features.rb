# Script to populate tasks for all existing features
# Run with: rails runner db/populate_tasks_for_features.rb

puts "Populating tasks for all features..."

# Define standard tasks by department
TASKS_BY_DEPARTMENT = {
  'Art' => [
    { name: 'Concept', duration_percent: 0.15 },
    { name: 'Modeling', duration_percent: 0.25 },
    { name: 'Texturing', duration_percent: 0.20 },
    { name: 'Rigging', duration_percent: 0.15 },
    { name: 'Final Polish', duration_percent: 0.25 }
  ],
  'Animation' => [
    { name: 'Planning', duration_percent: 0.10 },
    { name: 'Blocking', duration_percent: 0.20 },
    { name: 'Animation', duration_percent: 0.40 },
    { name: 'Polish', duration_percent: 0.20 },
    { name: 'Integration', duration_percent: 0.10 }
  ],
  'Programming' => [
    { name: 'Design', duration_percent: 0.15 },
    { name: 'Implementation', duration_percent: 0.50 },
    { name: 'Testing', duration_percent: 0.20 },
    { name: 'Optimization', duration_percent: 0.15 }
  ],
  'Design' => [
    { name: 'Research', duration_percent: 0.15 },
    { name: 'Prototyping', duration_percent: 0.25 },
    { name: 'Design Document', duration_percent: 0.30 },
    { name: 'Iteration', duration_percent: 0.20 },
    { name: 'Final Review', duration_percent: 0.10 }
  ],
  'Audio' => [
    { name: 'Design', duration_percent: 0.20 },
    { name: 'Recording/Creation', duration_percent: 0.40 },
    { name: 'Editing', duration_percent: 0.25 },
    { name: 'Integration', duration_percent: 0.15 }
  ],
  'Production' => [
    { name: 'Planning', duration_percent: 0.20 },
    { name: 'Coordination', duration_percent: 0.30 },
    { name: 'Review', duration_percent: 0.30 },
    { name: 'Documentation', duration_percent: 0.20 }
  ]
}.freeze

# Special tasks for "Main Character" type features
MAIN_CHARACTER_TASKS = [
  { name: 'Concept', duration_percent: 0.10 },
  { name: 'Modeling', duration_percent: 0.20 },
  { name: 'Texturing', duration_percent: 0.15 },
  { name: 'Rigging', duration_percent: 0.10 },
  { name: 'Animation', duration_percent: 0.25 },
  { name: 'Sound', duration_percent: 0.10 },
  { name: 'Skills VFX', duration_percent: 0.10 }
].freeze

def create_tasks_for_feature(feature)
  return unless feature.start_date && feature.end_date
  
  duration = (feature.end_date - feature.start_date).to_i + 1
  return if duration <= 0
  
  # Check if feature already has tasks
  if feature.tasks.any?
    puts "  ⚠️  Feature '#{feature.name}' already has #{feature.tasks.count} task(s), skipping..."
    return
  end
  
  # Determine which tasks to use
  tasks_to_create = if feature.name.downcase.include?('main character') || feature.name.downcase.include?('character')
    MAIN_CHARACTER_TASKS
  else
    TASKS_BY_DEPARTMENT[feature.department] || TASKS_BY_DEPARTMENT['Art']
  end
  
  current_day = 1
  order = 0
  
  tasks_to_create.each do |task_data|
    task_duration = [(duration * task_data[:duration_percent]).round, 1].max
    task_end_day = [current_day + task_duration - 1, duration].min
    
    # Calculate actual dates
    task_start_date = feature.start_date + (current_day - 1).days
    task_end_date = feature.start_date + (task_end_day - 1).days
    
    # Ensure we don't exceed feature end date
    task_end_date = [task_end_date, feature.end_date].min
    task_duration = (task_end_date - task_start_date).to_i + 1
    
    task = feature.tasks.create!(
      name: task_data[:name],
      status: 'not_started',
      department: feature.department,
      start_date: task_start_date,
      end_date: task_end_date,
      duration: task_duration,
      order: order
    )
    
    puts "    ✓ Created task: #{task.name} (#{task_duration} days, days #{current_day}-#{task_end_day})"
    
    current_day = task_end_day + 1
    order += 1
    
    # Stop if we've filled the entire feature duration
    break if current_day > duration
  end
  
  puts "  ✅ Created #{feature.tasks.count} task(s) for '#{feature.name}'"
end

# Process all features
features_count = ProjectFeature.count
puts "Found #{features_count} feature(s) to process\n\n"

ProjectFeature.includes(:tasks).find_each do |feature|
  puts "Processing feature: #{feature.name} (#{feature.department})"
  create_tasks_for_feature(feature)
  puts ""
end

total_tasks = Task.count
puts "✅ Done! Total tasks created: #{total_tasks}"

