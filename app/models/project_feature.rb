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

  # Validations
  validates :name, presence: true, uniqueness: { scope: :project_id, message: "already exists in this project" }
  validates :status, inclusion: { in: %w[not_started work_in_progress job_done] }, allow_nil: false

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

  def project_feature_params
    params.require(:project_feature).permit(:name, :duration, :status,
                                          responsible_contributor_ids: [],
                                          accountable_contributor_ids: [])
  end

  def set_default_status
    self.status ||= 'not_started'
  end
end
