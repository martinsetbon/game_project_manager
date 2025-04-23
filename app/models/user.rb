class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :projects, dependent: :destroy # projects they own
  has_many :project_contributors
  has_many :contributed_projects, through: :project_contributors, source: :project
  has_many :feature_assignments
  has_many :assigned_features, through: :feature_assignments, source: :feature
  validates :name, :email, :job, presence: true
end
