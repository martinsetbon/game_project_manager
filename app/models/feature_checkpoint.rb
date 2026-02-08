class FeatureCheckpoint < ApplicationRecord
  belongs_to :project_feature

  validates :day, presence: true, numericality: { greater_than: 0 }
  validates :day, uniqueness: { scope: :project_feature_id, message: "Checkpoint already exists for this day" }
  validate :day_within_feature_duration

  after_create :notify_accountable, if: -> { project_feature.accountable_contributors.any? }

  private

  def day_within_feature_duration
    return unless project_feature&.start_date && project_feature&.end_date
    return unless day.present?

    duration = (project_feature.end_date - project_feature.start_date).to_i + 1
    if day > duration
      errors.add(:day, "must be within feature duration (#{duration} days)")
    end
    if day < 1
      errors.add(:day, "must be greater than 0")
    end
  end

  def notify_accountable
    # Create notification for accountable contributors
    begin
      project_feature.accountable_contributors.each do |accountable|
        Notification.create!(
          user: accountable,
          project: project_feature.project,
          project_feature: project_feature,
          notification_type: 'checkpoint',
          title: "Checkpoint scheduled for #{project_feature.name}",
          message: "A checkpoint has been scheduled at the end of day #{day} of feature '#{project_feature.name}'. Please review the work before day #{day + 1}.",
          priority: 'normal'
        )
      end
      update_column(:notified, true)
    rescue => e
      Rails.logger.error "Failed to notify accountable contributors: #{e.message}"
      # Don't fail the checkpoint creation if notification fails
    end
  end
end

