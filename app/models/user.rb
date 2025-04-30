class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :projects, dependent: :destroy # projects they own
  has_many :project_contributors, dependent: :destroy
  has_many :contributed_projects, through: :project_contributors, source: :project
  has_many :feature_assignments, dependent: :destroy
  has_many :assigned_features, through: :feature_assignments, source: :project_feature

  validates :name, :email, :job, presence: true

  # New methods for responsible/accountable features
  def responsible_features
    assigned_features.joins(:feature_assignments)
                    .where(feature_assignments: { role: 'responsible' })
                    .distinct
  end

  def accountable_features
    assigned_features.joins(:feature_assignments)
                    .where(feature_assignments: { role: 'accountable' })
                    .distinct
  end

  # Features where user is either responsible or accountable
  def involved_features
    assigned_features.distinct
  end

  # Features that are waiting for user's action
  def pending_features
    responsible_features.where(status: 'not_started') +
    accountable_features.where(status: 'work_in_progress')
  end

  # All projects where user is involved (either as owner, contributor, or feature assignee)
  def involved_projects
    (projects + contributed_projects + assigned_features.map(&:project)).uniq
  end
end
