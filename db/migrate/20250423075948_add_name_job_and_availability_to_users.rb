class AddNameJobAndAvailabilityToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :name, :string
    add_column :users, :job, :string
    add_column :users, :available, :boolean
  end
end
