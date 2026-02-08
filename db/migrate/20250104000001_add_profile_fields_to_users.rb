class AddProfileFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :country, :string
    add_column :users, :self_introduction, :text
    add_column :users, :hobbies, :text
    add_column :users, :skills, :text # Will store JSON array
    add_column :users, :speaking_languages, :text # Will store JSON array
  end
end

