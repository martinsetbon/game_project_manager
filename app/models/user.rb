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
  has_many :task_assignments, dependent: :destroy
  has_many :assigned_tasks, through: :task_assignments, source: :task
  has_many :directly_assigned_tasks, class_name: 'Task', foreign_key: 'assigned_user_id', dependent: :nullify
  has_many :notifications, dependent: :destroy
  has_many :feature_templates, dependent: :destroy

  # ActiveStorage attachments
  has_one_attached :avatar
  has_one_attached :resume

  # Serialize JSON fields
  serialize :skills, coder: JSON, default: []
  serialize :speaking_languages, coder: JSON, default: []

  validates :name, :email, :job, presence: true

  # Ensure arrays are always arrays (not nil)
  before_validation :ensure_array_fields

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

  # Check if user is project manager for a project
  def project_manager?(project)
    project.user == self
  end

  # Check if user is contributor to a project
  def contributor?(project)
    contributed_projects.include?(project)
  end

  # Get features waiting for approval (where user is accountable)
  def features_waiting_for_approval
    accountable_features.where(status: 'work_in_progress', approval_requested: true)
  end

  # Get features that can be worked on (where user is responsible)
  def features_to_work_on
    responsible_features.where(status: ['not_started', 'work_in_progress', 'stand_by'])
  end

  private

  def ensure_array_fields
    self.skills ||= []
    self.speaking_languages ||= []
  end
end
