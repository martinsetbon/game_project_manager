class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :project
  belongs_to :project_feature, optional: true

  validates :notification_type, presence: true, inclusion: { 
    in: %w[feature_assigned feature_overdue approval_requested accountable_overdue] 
  }
  validates :title, presence: true
  validates :message, presence: true
  validates :priority, presence: true, inclusion: { in: %w[normal high] }

  scope :unread, -> { where(read: false) }
  scope :unviewed, -> { where(viewed: false) }
  scope :by_priority, -> { order(priority: :desc, created_at: :desc) }
  scope :recent, -> { order(created_at: :desc) }

  def mark_as_read!
    update!(read: true)
  end

  def mark_as_viewed!
    update!(viewed: true)
  end

  def self.create_for_feature_assignment(feature, user, role)
    Rails.logger.info "Creating notification for user #{user.id} (#{user.email}) for feature #{feature.id} (#{feature.name}) as #{role}"
    Rails.logger.info "Project: #{feature.project.id} (#{feature.project.name})"
    
    notification = new(
      user: user,
      project: feature.project,
      project_feature: feature,
      notification_type: 'feature_assigned',
      title: "Feature assigned to you",
      message: "You are #{role} for '#{feature.name}' in #{feature.project.name}",
      priority: 'normal',
      read: false,
      viewed: false
    )
    
    if notification.valid?
      notification.save!
      Rails.logger.info "Notification saved successfully: #{notification.id}"
      notification
    else
      Rails.logger.error "Notification validation failed: #{notification.errors.full_messages}"
      raise ActiveRecord::RecordInvalid.new(notification)
    end
  end

  def self.create_for_overdue_feature(feature, user, role)
    create!(
      user: user,
      project: feature.project,
      project_feature: feature,
      notification_type: 'feature_overdue',
      title: "Overdue feature",
      message: "You are #{role} for overdue feature '#{feature.name}' in #{feature.project.name}",
      priority: 'high',
      read: false,
      viewed: false
    )
  end

  def self.create_for_approval_request(feature, user)
    create!(
      user: user,
      project: feature.project,
      project_feature: feature,
      notification_type: 'approval_requested',
      title: "Approval requested",
      message: "Approval requested for '#{feature.name}' in #{feature.project.name}",
      priority: 'high',
      read: false,
      viewed: false
    )
  end
end
