# app/models/task.rb
class Task < ApplicationRecord
  belongs_to :project_feature, optional: true
  belongs_to :parent_task, class_name: 'Task', optional: true
  belongs_to :assigned_user, class_name: 'User', optional: true
  belongs_to :project, optional: true
  belongs_to :backlog_user, class_name: 'User', foreign_key: 'backlog_user_id', optional: true
  
  has_many :subtasks, class_name: 'Task', foreign_key: 'parent_task_id', dependent: :destroy
  has_many :task_assignments, dependent: :destroy
  has_many :assigned_users, through: :task_assignments, source: :user
  
  # Explicit associations for responsible/accountable users
  has_many :responsible_assignments,
           -> { where(role: 'responsible') },
           class_name: 'TaskAssignment'
  has_many :responsible_users,
           through: :responsible_assignments,
           source: :user

  has_many :accountable_assignments,
           -> { where(role: 'accountable') },
           class_name: 'TaskAssignment'
  has_many :accountable_users,
           through: :accountable_assignments,
           source: :user

  # Validations
  validates :name, presence: true
  validate :unique_name_per_scope
  validates :status, inclusion: { in: %w[not_started work_in_progress stand_by job_done] }, allow_nil: false
  validates :department, inclusion: { in: %w[Production Design Art Animation Programming Audio] }, allow_nil: true
  validates :duration, numericality: { greater_than: 0 }, allow_nil: true
  validates :backlog_type, inclusion: { in: %w[user project] }, allow_nil: true
  validates :priority, inclusion: { in: %w[high medium low] }, allow_nil: true, allow_blank: true
  validate :backlog_requirements

  # Scopes
  scope :top_level, -> { where(parent_task_id: nil) }
  scope :ordered, -> { order(:start_date, :order, :created_at) }
  scope :by_status, ->(status) { where(status: status) }
  scope :by_priority, ->(priority) { where(priority: priority) }
  # Backlog: tasks without start_date AND end_date, OR with backlog_type set
  scope :in_backlog, -> { where('(start_date IS NULL AND end_date IS NULL) OR backlog_type IS NOT NULL') }
  scope :user_backlog, ->(user_id) { where(backlog_type: 'user', backlog_user_id: user_id) }
  scope :project_backlog, ->(project_id) { where(backlog_type: 'project', project_id: project_id) }
  scope :not_in_backlog, -> { where.not(start_date: nil).where.not(end_date: nil).where(backlog_type: nil) }

  # Callbacks
  before_save :normalize_priority
  before_save :set_end_date
  before_save :set_backlog_if_no_dates
  before_create :set_start_date_if_nil

  # Methods
  def top_level?
    parent_task_id.nil?
  end

  def subtask?
    !top_level?
  end

  def in_backlog?
    # A task is in backlog if it has no start_date AND end_date, OR if backlog_type is set
    (start_date.nil? && end_date.nil?) || backlog_type.present?
  end

  def overdue?
    return false if end_date.nil?
    return false if status == 'job_done'
    return false if in_backlog? # Backlog tasks are never overdue
    
    Date.current > end_date && ['not_started', 'work_in_progress'].include?(status)
  end

  def can_change_status?(user)
    # For backlog tasks
    if backlog_type == 'user'
      return true if backlog_user_id == user.id
    elsif backlog_type == 'project'
      return true if project&.user == user
    end
    
    # For regular tasks
    if project_feature.present?
      # Project manager (owner) can change any status
      return true if project_feature.project.user == user
      
      # Assigned user (direct or through assignments) can change status
      return true if assigned_user == user || assigned_users.include?(user)
    end
    
    false
  end

  # Calculate the day number relative to feature start (1-based)
  def start_day
    return nil unless project_feature.start_date && start_date
    (start_date - project_feature.start_date).to_i + 1
  end

  # Calculate the day number relative to feature start (1-based)
  def end_day
    return nil unless project_feature.start_date && end_date
    (end_date - project_feature.start_date).to_i + 1
  end

  private

  def set_end_date
    # Skip for backlog tasks (backlog_type is set or both dates are nil)
    return if backlog_type.present? || (start_date.nil? && end_date.nil?)
    
    if start_date.present? && duration.present? && end_date.nil?
      self.end_date = start_date + duration.days
    end
  end

  def set_start_date_if_nil
    # Only set start_date automatically if not creating a backlog task
    # Skip if this is a backlog task (backlog_type is set or both dates are nil)
    return if backlog_type.present? || (start_date.nil? && end_date.nil?)
    
    if start_date.nil? && project_feature&.start_date.present? && end_date.present?
      self.start_date = project_feature.start_date
    end
  end

  def normalize_priority
    # Convert blank strings to nil for priority
    self.priority = nil if priority.blank?
  end

  def set_backlog_if_no_dates
    # If task has no dates, ensure it's marked as backlog
    # Priority is not required for backlog - tasks go to backlog if they have no dates
    if start_date.nil? && end_date.nil?
      # Set backlog_type to 'project' if project_id is present, otherwise keep nil
      # (nil backlog_type with no dates still means backlog, but we'll handle it in queries)
      if project_id.present? && backlog_type.nil?
        self.backlog_type = 'project'
      end
    end
  end
  
  def backlog_requirements
    if backlog_type.present?
      if backlog_type == 'user' && backlog_user_id.blank?
        errors.add(:backlog_user_id, "must be present for user backlog tasks")
      elsif backlog_type == 'project' && project_id.blank?
        errors.add(:project_id, "must be present for project backlog tasks")
      end
    end
  end
  
  def unique_name_per_scope
    return if name.blank?
    
    scope = if backlog_type == 'user'
      Task.where(backlog_type: 'user', backlog_user_id: backlog_user_id, name: name)
    elsif backlog_type == 'project'
      Task.where(backlog_type: 'project', project_id: project_id, name: name)
    elsif project_feature_id.present?
      Task.where(project_feature_id: project_feature_id, backlog_type: nil, name: name)
    else
      return # No scope to validate
    end
    
    scope = scope.where.not(id: id) if persisted?
    
    if scope.exists?
      if backlog_type == 'user'
        errors.add(:name, "already exists in your backlog")
      elsif backlog_type == 'project'
        errors.add(:name, "already exists in project backlog")
      else
        errors.add(:name, "already exists in this feature")
      end
    end
  end
end

