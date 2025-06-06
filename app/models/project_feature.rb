# app/models/project_feature.rb
class ProjectFeature < ApplicationRecord
  belongs_to :project
  has_many :feature_assignments, dependent: :destroy
  has_many :contributors, through: :feature_assignments, source: :user

  # Explicit associations for responsible/accountable contributors
  has_many :responsible_assignments,
           -> { where(role: 'responsible') },
           class_name: 'FeatureAssignment'
  has_many :responsible_contributors,
           through: :responsible_assignments,
           source: :user

  has_many :accountable_assignments,
           -> { where(role: 'accountable') },
           class_name: 'FeatureAssignment'
  has_many :accountable_contributors,
           through: :accountable_assignments,
           source: :user

  # Virtual attributes for form
  attr_accessor :responsible_user_id, :accountable_user_id

  # Validations
  validates :name, presence: true, uniqueness: { scope: :project_id, message: "already exists in this project" }
  validates :status, inclusion: { in: %w[not_started work_in_progress job_done] }, allow_nil: false
  validates :department, presence: true, inclusion: { in: %w[Production Design Art Animation Programming Audio] }
  validates :duration, presence: true, numericality: { greater_than: 0 }

  DEPARTMENTS = %w[Production Design Art Animation Programming Audio].freeze

  # Callbacks
  before_create :set_start_date
  before_save :set_end_date

  # Methods
  def can_change_status?(contributor)
    return false unless contributor.present?

    case status
    when 'not_started'
      responsible_contributors.exists?(id: contributor.id)
    when 'work_in_progress'
      accountable_contributors.exists?(id: contributor.id) ||
        (responsible_contributors.exists?(id: contributor.id) &&
         accountable_contributors.exists?(id: contributor.id))
    else
      false
    end
  end

  after_initialize :set_default_status, if: :new_record?

  private

  def set_default_status
    self.status ||= 'not_started'
  end

  def set_start_date
    self.start_date ||= Date.today
  end

  def set_end_date
    return unless duration.present? && start_date.present?
    self.end_date = start_date + duration.days
  end
end
