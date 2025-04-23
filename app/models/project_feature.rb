class ProjectFeature < ApplicationRecord
  belongs_to :project

  has_many :feature_assignments
  has_many :contributors, through: :feature_assignments, source: :user

  validates :name, :duration, presence: true
end
