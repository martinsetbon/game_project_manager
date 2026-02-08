class AddViewedToNotifications < ActiveRecord::Migration[7.0]
  def change
    add_column :notifications, :viewed, :boolean, default: false, null: false
    add_index :notifications, :viewed
  end
end
