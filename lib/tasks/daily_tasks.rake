namespace :daily do
  desc "Run daily maintenance tasks"
  task all: :environment do
    puts "Running daily maintenance tasks..."
    
    # Extend end dates for stand-by features
    Rake::Task['features:extend_stand_by'].invoke
    
    puts "Daily maintenance tasks completed."
  end
end
