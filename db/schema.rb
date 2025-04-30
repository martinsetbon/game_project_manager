# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2025_04_27_170903) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "feature_assignments", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_feature_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role", default: "responsible", null: false
    t.index ["project_feature_id"], name: "index_feature_assignments_on_project_feature_id"
    t.index ["user_id"], name: "index_feature_assignments_on_user_id"
  end

  create_table "project_contributors", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_project_contributors_on_project_id"
    t.index ["user_id"], name: "index_project_contributors_on_user_id"
  end

  create_table "project_features", force: :cascade do |t|
    t.string "name"
    t.integer "duration"
    t.bigint "project_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "not_started", null: false
    t.index ["project_id"], name: "index_project_features_on_project_id"
  end

  create_table "projects", force: :cascade do |t|
    t.string "name"
    t.text "description"
    t.date "start_date"
    t.date "end_date"
    t.string "budget"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "currency"
    t.index ["user_id"], name: "index_projects_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.string "job"
    t.boolean "available"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "feature_assignments", "project_features"
  add_foreign_key "feature_assignments", "users"
  add_foreign_key "project_contributors", "projects"
  add_foreign_key "project_contributors", "users"
  add_foreign_key "project_features", "projects"
  add_foreign_key "projects", "users"
end
