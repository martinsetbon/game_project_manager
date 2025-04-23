# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

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
