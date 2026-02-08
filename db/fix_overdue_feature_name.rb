# Script to find and rename features with "overdue" in the name
# Run with: rails runner db/fix_overdue_feature_name.rb

puts "Searching for features with 'overdue' in the name..."

features = ProjectFeature.where('name ILIKE ?', '%overdue%')

if features.empty?
  puts "✅ No features found with 'overdue' in the name."
else
  puts "Found #{features.count} feature(s) with 'overdue' in name:"
  features.each do |feature|
    puts "  - ID: #{feature.id}"
    puts "    Current Name: '#{feature.name}'"
    puts "    Project: #{feature.project.name}"
    puts "    Department: #{feature.department}"
    
    # Rename to "Main Character" as requested
    old_name = feature.name
    new_name = 'Main Character'
    
    # Check if "Main Character" already exists in this project
    if feature.project.project_features.exists?(name: new_name) && feature.project.project_features.find_by(name: new_name).id != feature.id
      puts "    ⚠️  Warning: '#{new_name}' already exists in this project."
      puts "    Keeping original name. Please rename manually."
      next
    end
    
    # Update the feature name
    feature.update!(name: new_name)
    puts "✅ Renamed '#{old_name}' to '#{new_name}'"
  end
end

puts "\n✅ Done!"

