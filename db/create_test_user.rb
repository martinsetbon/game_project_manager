# Quick script to create/recreate the test user
# Run with: rails runner db/create_test_user.rb

puts "Creating test user..."

test_user = User.find_or_create_by!(email: "project.manager.test1@example.com") do |u|
  u.name = "project manager test 1"
  u.password = "password"
  u.job = "Project Manager"
  u.available = true
end

puts "✅ User created/found:"
puts "   Email: #{test_user.email}"
puts "   Password: password"
puts "   Name: #{test_user.name}"

