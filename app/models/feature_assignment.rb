# app/models/feature_assignment.rb
class FeatureAssignment < ApplicationRecord
  belongs_to :user
  belongs_to :project_feature

  ROLES = %w[responsible accountable].freeze
  validates :role, presence: true, inclusion: { in: ROLES }

  scope :responsible, -> { where(role: 'responsible') }
  scope :accountable, -> { where(role: 'accountable') }

  validate :warn_same_user_assignment, if: -> { role == 'accountable' && same_user_responsible? }

  # Callbacks to adjust dates when responsible assignments change
  # Disabled to prevent feature deletion during updates
  # after_create :adjust_dates_if_responsible
  # after_destroy :adjust_dates_if_responsible
  
  # Create notification when assignment is created
  after_create :create_assignment_notification

  private

  def same_user_responsible?
    project_feature.feature_assignments.where(role: 'responsible').exists?(user_id: user_id)
  end

  def warn_same_user_assignment
    if same_user_responsible?
      errors.add(:base, "Warning: This user is already assigned as responsible. Having the same user as both responsible and accountable is not recommended.")
    end
  end

  def adjust_dates_if_responsible
    return unless role == 'responsible'
    return if project_feature.nil?
    # Adjust all features for this responsible contributor in the project
    ProjectFeature.adjust_all_for_responsible_contributor(user_id, project_feature.project_id)
  end

  def create_assignment_notification
    Rails.logger.info "Creating notification for user #{user.email} for feature #{project_feature.name} as #{role}"
    begin
      notification = Notification.create_for_feature_assignment(project_feature, user, role)
      Rails.logger.info "Notification created successfully: #{notification.id}"
    rescue => e
      Rails.logger.error "Failed to create notification: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
    end
  end
end
