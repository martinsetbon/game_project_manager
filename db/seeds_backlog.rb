# Script to create test backlog tasks
# Run with: rails runner db/seeds_backlog.rb

puts "Creating test backlog tasks..."

# Get the first user (project creator)
user = User.first
if user.nil?
  puts "❌ No users found! Please run db:seed first."
  exit
end

# Get the first project
project = Project.first
if project.nil?
  puts "❌ No projects found! Please run db:seed first."
  exit
end

# User backlog tasks
user_backlog_tasks = [
  {
    name: "Review UI mockups",
    description: "Go through all the UI mockups and provide feedback",
    department: "Design",
    status: "not_started",
    duration: 3
  },
  {
    name: "Update documentation",
    description: "Update project documentation with latest changes",
    department: "Production",
    status: "not_started",
    duration: 5
  },
  {
    name: "Fix minor bugs",
    description: "Fix the list of minor bugs reported in testing",
    department: "Programming",
    status: "not_started",
    duration: 2
  },
  {
    name: "Create sound effects library",
    description: "Compile and organize all sound effects",
    department: "Audio",
    status: "not_started",
    duration: 7
  },
  {
    name: "Optimize textures",
    description: "Optimize texture sizes for better performance",
    department: "Art",
    status: "not_started",
    duration: 4
  },
  {
    name: "Research competitor games",
    description: "Research similar games for inspiration and market analysis",
    department: "Design",
    status: "not_started",
    duration: 3
  }
]

puts "\nCreating user backlog tasks..."
user_backlog_tasks.each do |task_data|
  task = Task.find_or_create_by!(
    name: task_data[:name],
    backlog_type: 'user',
    backlog_user_id: user.id
  ) do |t|
    t.description = task_data[:description]
    t.department = task_data[:department]
    t.status = task_data[:status]
    t.duration = task_data[:duration]
  end
  puts "✅ Created user backlog task: #{task.name}"
end

# Project backlog tasks
project_backlog_tasks = [
  {
    name: "Implement multiplayer features",
    description: "Add multiplayer functionality - low priority for now",
    department: "Programming",
    status: "not_started",
    duration: 30
  },
  {
    name: "Create DLC content",
    description: "Design and create downloadable content",
    department: "Design",
    status: "not_started",
    duration: 45
  },
  {
    name: "Port to mobile platforms",
    description: "Adapt game for mobile devices",
    department: "Programming",
    status: "not_started",
    duration: 60
  },
  {
    name: "Add achievements system",
    description: "Implement achievements and trophies",
    department: "Programming",
    status: "not_started",
    duration: 10
  },
  {
    name: "Create marketing trailer",
    description: "Produce promotional video for marketing",
    department: "Art",
    status: "not_started",
    duration: 14
  },
  {
    name: "Localization support",
    description: "Add support for multiple languages",
    department: "Production",
    status: "not_started",
    duration: 20
  },
  {
    name: "VR mode implementation",
    description: "Add VR support - experimental feature",
    department: "Programming",
    status: "not_started",
    duration: 90
  },
  {
    name: "Advanced particle effects",
    description: "Enhance visual effects with advanced particles",
    department: "Art",
    status: "not_started",
    duration: 15
  }
]

puts "\nCreating project backlog tasks..."
project_backlog_tasks.each do |task_data|
  task = Task.find_or_create_by!(
    name: task_data[:name],
    backlog_type: 'project',
    project_id: project.id
  ) do |t|
    t.description = task_data[:description]
    t.department = task_data[:department]
    t.status = task_data[:status]
    t.duration = task_data[:duration]
  end
  puts "✅ Created project backlog task: #{task.name}"
end

puts "\n✅ Backlog seeding completed!"
puts "   → Created #{Task.user_backlog(user.id).count} user backlog tasks"
puts "   → Created #{Task.project_backlog(project.id).count} project backlog tasks"

