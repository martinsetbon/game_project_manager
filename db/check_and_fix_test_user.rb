# Script to check and fix the test user
# Run with: rails runner db/check_and_fix_test_user.rb

puts "="*60
puts "CHECKING AND FIXING TEST USER"
puts "="*60

# First, list all existing users
puts "\nAll users in database:"
User.all.each do |u|
  puts "  - #{u.email} (#{u.name})"
end

puts "\n" + "-"*60

# Try different email variations
emails_to_check = [
  "project.manager.test1@example.com",
  "project-manager-test1@example.com",
  "project-manager-test1@exemple.com"
]

user = nil
emails_to_check.each do |email|
  user = User.find_by(email: email)
  if user
    puts "Found user with email: #{email}"
    break
  end
end

if user.nil?
  puts "\n❌ User not found. Creating new user..."
  begin
    user = User.create!(
      name: "project manager test 1",
      email: "project.manager.test1@example.com",
      password: "password",
      password_confirmation: "password",
      job: "Project Manager",
      available: true
    )
    puts "✅ Created user: #{user.name}"
    puts "   Email: #{user.email}"
    puts "   ID: #{user.id}"
  rescue => e
    puts "❌ Error creating user: #{e.message}"
    puts "   Errors: #{user&.errors&.full_messages&.join(', ')}"
    exit 1
  end
else
  puts "\n✅ Found existing user: #{user.name}"
  puts "   Email: #{user.email}"
  puts "   ID: #{user.id}"
  
  # Reset password to be sure
  puts "\nResetting password..."
  user.password = "password"
  user.password_confirmation = "password"
  if user.save
    puts "✅ Password reset to 'password'"
  else
    puts "❌ Error saving password: #{user.errors.full_messages.join(', ')}"
  end
end

# Verify password works
puts "\n" + "-"*60
puts "Verifying credentials..."
if user.valid_password?("password")
  puts "✅ Password verification successful!"
else
  puts "❌ Password verification failed!"
  puts "   Trying to reset password again..."
  user.password = "password"
  user.password_confirmation = "password"
  user.save!
  if user.valid_password?("password")
    puts "✅ Password reset and verified!"
  else
    puts "❌ Still failing after reset!"
  end
end

# Check if user can authenticate
puts "\nTesting authentication..."
auth_user = User.find_for_database_authentication(email: user.email)
if auth_user && auth_user.valid_password?("password")
  puts "✅ Authentication test successful!"
else
  puts "❌ Authentication test failed!"
end

puts "\n" + "="*60
puts "LOGIN CREDENTIALS:"
puts "="*60
puts "Email: #{user.email}"
puts "Password: password"
puts "="*60
puts "\n⚠️  Make sure you're using the EXACT email above (copy-paste it)"
puts "⚠️  Password is exactly: password (all lowercase, no quotes)"
puts "="*60

