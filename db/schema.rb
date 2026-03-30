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

ActiveRecord::Schema[7.1].define(version: 2026_03_08_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "feature_assignments", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_feature_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "role", default: "responsible", null: false
    t.index ["project_feature_id"], name: "index_feature_assignments_on_project_feature_id"
    t.index ["user_id"], name: "index_feature_assignments_on_user_id"
  end

  create_table "feature_checkpoints", force: :cascade do |t|
    t.integer "day", null: false
    t.bigint "project_feature_id", null: false
    t.boolean "notified", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_feature_id", "day"], name: "index_feature_checkpoints_on_project_feature_id_and_day", unique: true
    t.index ["project_feature_id"], name: "index_feature_checkpoints_on_project_feature_id"
  end

  create_table "feature_segments", force: :cascade do |t|
    t.string "name", null: false
    t.integer "start_day", null: false
    t.integer "end_day", null: false
    t.bigint "project_feature_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_feature_id", "start_day", "end_day"], name: "idx_on_project_feature_id_start_day_end_day_a42aacab08"
    t.index ["project_feature_id"], name: "index_feature_segments_on_project_feature_id"
  end

  create_table "feature_templates", force: :cascade do |t|
    t.string "name"
    t.bigint "user_id", null: false
    t.text "tasks_data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_feature_templates_on_user_id"
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "project_id", null: false
    t.bigint "project_feature_id"
    t.string "notification_type", null: false
    t.string "title", null: false
    t.text "message", null: false
    t.boolean "read", default: false
    t.string "priority", default: "normal"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "viewed", default: false, null: false
    t.index ["notification_type"], name: "index_notifications_on_notification_type"
    t.index ["project_feature_id"], name: "index_notifications_on_project_feature_id"
    t.index ["project_id"], name: "index_notifications_on_project_id"
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id", "read"], name: "index_notifications_on_user_id_and_read"
    t.index ["user_id"], name: "index_notifications_on_user_id"
    t.index ["viewed"], name: "index_notifications_on_viewed"
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
    t.date "start_date"
    t.date "end_date"
    t.bigint "parent_feature_id"
    t.boolean "approval_requested", default: false
    t.datetime "approval_requested_at"
    t.datetime "stand_by_started_at"
    t.index ["approval_requested"], name: "index_project_features_on_approval_requested"
    t.index ["parent_feature_id"], name: "index_project_features_on_parent_feature_id"
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
    t.string "status"
    t.index ["user_id"], name: "index_projects_on_user_id"
  end

  create_table "task_assignments", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "task_id", null: false
    t.string "role", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["role"], name: "index_task_assignments_on_role"
    t.index ["task_id", "user_id", "role"], name: "index_task_assignments_on_task_id_and_user_id_and_role", unique: true
    t.index ["task_id"], name: "index_task_assignments_on_task_id"
    t.index ["user_id"], name: "index_task_assignments_on_user_id"
  end

  create_table "task_checkpoints", force: :cascade do |t|
    t.integer "day", null: false
    t.bigint "task_id", null: false
    t.boolean "notified", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.index ["task_id", "day"], name: "index_task_checkpoints_on_task_id_and_day", unique: true
    t.index ["task_id"], name: "index_task_checkpoints_on_task_id"
  end

  create_table "task_links", force: :cascade do |t|
    t.bigint "source_task_id", null: false
    t.bigint "target_task_id", null: false
    t.integer "anchor_day", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "offset_days", default: 0, null: false
    t.index ["source_task_id", "target_task_id"], name: "index_task_links_on_source_task_id_and_target_task_id", unique: true
    t.index ["source_task_id"], name: "index_task_links_on_source_task_id"
    t.index ["target_task_id"], name: "index_task_links_on_target_task_id"
  end

  create_table "task_segments", force: :cascade do |t|
    t.string "name", null: false
    t.decimal "start_day", precision: 5, scale: 1, null: false
    t.decimal "end_day", precision: 5, scale: 1, null: false
    t.bigint "task_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "color"
    t.decimal "default_percent", precision: 5, scale: 1
    t.boolean "percent_flagged", default: false, null: false
    t.index ["task_id", "start_day", "end_day"], name: "index_task_segments_on_task_id_and_start_day_and_end_day"
    t.index ["task_id"], name: "index_task_segments_on_task_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "status", default: "not_started", null: false
    t.string "department"
    t.date "start_date"
    t.date "end_date"
    t.integer "duration"
    t.integer "order", default: 0
    t.bigint "project_feature_id"
    t.bigint "parent_task_id"
    t.bigint "assigned_user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "backlog_type"
    t.bigint "backlog_user_id"
    t.bigint "project_id"
    t.string "priority"
    t.time "start_time"
    t.time "end_time"
    t.index ["assigned_user_id"], name: "index_tasks_on_assigned_user_id"
    t.index ["backlog_type"], name: "index_tasks_on_backlog_type"
    t.index ["backlog_user_id"], name: "index_tasks_on_backlog_user_id"
    t.index ["order"], name: "index_tasks_on_order"
    t.index ["parent_task_id"], name: "index_tasks_on_parent_task_id"
    t.index ["priority"], name: "index_tasks_on_priority"
    t.index ["project_feature_id", "name"], name: "index_tasks_on_project_feature_id_and_name", unique: true
    t.index ["project_feature_id"], name: "index_tasks_on_project_feature_id"
    t.index ["project_id"], name: "index_tasks_on_project_id"
    t.index ["status"], name: "index_tasks_on_status"
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
    t.string "country"
    t.text "self_introduction"
    t.text "hobbies"
    t.text "skills"
    t.text "speaking_languages"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "feature_assignments", "project_features"
  add_foreign_key "feature_assignments", "users"
  add_foreign_key "feature_checkpoints", "project_features"
  add_foreign_key "feature_segments", "project_features"
  add_foreign_key "feature_templates", "users"
  add_foreign_key "notifications", "project_features"
  add_foreign_key "notifications", "projects"
  add_foreign_key "notifications", "users"
  add_foreign_key "project_contributors", "projects"
  add_foreign_key "project_contributors", "users"
  add_foreign_key "project_features", "project_features", column: "parent_feature_id"
  add_foreign_key "project_features", "projects"
  add_foreign_key "projects", "users"
  add_foreign_key "task_assignments", "tasks"
  add_foreign_key "task_assignments", "users"
  add_foreign_key "task_checkpoints", "tasks"
  add_foreign_key "task_links", "tasks", column: "source_task_id"
  add_foreign_key "task_links", "tasks", column: "target_task_id"
  add_foreign_key "task_segments", "tasks"
  add_foreign_key "tasks", "project_features"
  add_foreign_key "tasks", "projects"
  add_foreign_key "tasks", "tasks", column: "parent_task_id"
  add_foreign_key "tasks", "users", column: "assigned_user_id"
  add_foreign_key "tasks", "users", column: "backlog_user_id"
end
