class AddCurrencyToProjects < ActiveRecord::Migration[7.1]
  def change
    add_column :projects, :currency, :string
  end
end
