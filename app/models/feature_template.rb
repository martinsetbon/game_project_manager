class FeatureTemplate < ApplicationRecord
  belongs_to :user
  
  validates :name, presence: true
  
  serialize :tasks_data, coder: JSON, type: Array
  
  scope :by_user, ->(user) { where(user: user) }
end
