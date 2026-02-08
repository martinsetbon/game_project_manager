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
  has_many :notifications, dependent: :destroy
  has_many :feature_segments, dependent: :destroy
  has_many :feature_checkpoints, dependent: :destroy
  has_many :tasks, dependent: :destroy

  # Virtual attributes for form
  attr_accessor :responsible_user_id, :accountable_user_id

  # Validations
  validates :name, presence: true, uniqueness: { scope: :project_id, message: "already exists in this project" }
  validates :status, inclusion: { in: %w[not_started work_in_progress stand_by job_done] }, allow_nil: false
  # Duration is optional now - we use start_date and end_date instead
  validates :duration, numericality: { greater_than: 0 }, allow_nil: true

  # Callbacks
  before_create :set_start_date
  before_save :set_end_date
  # after_save :update_status_from_dates # Disabled - users set status manually
  after_update :adjust_dates_if_duration_changed
  after_save :create_overdue_notifications

  # Methods
  def can_change_status?(user)
    # Project manager (owner) can change any status
    return true if project.user == user
    
    # Check if user is assigned to this feature
    assignment = feature_assignments.find_by(user: user)
    return false unless assignment
    
    case assignment.role
    when 'responsible'
      # Responsible can change from not_started to work_in_progress, work_in_progress to stand_by, and request approval
      ['not_started', 'work_in_progress', 'stand_by'].include?(status)
    when 'accountable'
      # Accountable can approve when approval is requested
      status == 'work_in_progress' && approval_requested == true
    else
      false
    end
  end

  def can_edit?(user)
    # Project manager can always edit
    return true if project.user == user
    
    # Completed features cannot be edited by anyone
    return false if status == 'job_done'
    
    # Contributors can access edit view to change status
    feature_assignments.exists?(user: user)
  end

  def can_edit_details?(user)
    # Only project manager (feature creator) can edit feature details
    return project.user == user
  end

  def can_delete?(user)
    # Only project manager can delete
    project.user == user
  end

  def request_approval!
    return false unless status == 'work_in_progress' && !approval_requested
    update!(
      approval_requested: true,
      approval_requested_at: Time.current
    )
  end

  def approve_completion!
    return false unless status == 'work_in_progress' && approval_requested
    update!(
      status: 'job_done',
      approval_requested: false,
      approval_requested_at: nil
    )
  end

  def set_stand_by!
    return false unless status == 'work_in_progress'
    update!(
      status: 'stand_by',
      stand_by_started_at: Time.current
    )
  end

  def resume_from_stand_by!
    return false unless status == 'stand_by'
    update!(
      status: 'work_in_progress',
      stand_by_started_at: nil
    )
  end

  def extend_end_date_for_stand_by!
    return unless status == 'stand_by' && stand_by_started_at.present?
    
    # Calculate days in stand by
    days_in_stand_by = (Date.current - stand_by_started_at.to_date).to_i
    puts "DEBUG: days_in_stand_by = #{days_in_stand_by}"
    
    if days_in_stand_by > 0
      old_end_date = self.end_date
      puts "DEBUG: old_end_date = #{old_end_date}"
      
      # Extend the end date
      self.end_date = self.end_date + days_in_stand_by.days
      puts "DEBUG: new_end_date = #{self.end_date}"
      
      # Update stand_by_started_at to current time to reset the counter
      self.stand_by_started_at = Time.current
      puts "DEBUG: new_stand_by_started_at = #{self.stand_by_started_at}"
      
      # Save the changes
      if save!
        puts "Extended feature '#{name}' by #{days_in_stand_by} days. Old: #{old_end_date}, New: #{self.end_date}"
      else
        puts "ERROR: Failed to save feature. Errors: #{errors.full_messages}"
      end
    else
      puts "No extension needed for feature '#{name}' (days_in_stand_by: #{days_in_stand_by})"
    end
  end

  # Automatically determine status based on current date and feature dates
  def calculate_status
    return 'not_started' if start_date.nil? || end_date.nil?
    
    # Don't auto-change status if it's manually set to stand_by
    return status if status == 'stand_by'
    
    today = Date.current
    
    if today < start_date
      'not_started'
    elsif today >= start_date && today <= end_date
      'work_in_progress'
    else
      'job_done'
    end
  end

  # Update status based on dates
  def update_status_from_dates!
    new_status = calculate_status
    update_column(:status, new_status) if status != new_status
  end

  # Check if feature is overdue (past end date but still not started or ongoing)
  def overdue?
    return false if end_date.nil?
    return false if status == 'job_done' # Completed features are not overdue
    
    Date.current > end_date && ['not_started', 'work_in_progress'].include?(status)
  end

  # Get overlapping features for the same responsible contributor
  def overlapping_features
    return [] if responsible_contributors.empty?
    
    responsible_user_ids = responsible_contributors.pluck(:id)
    
    overlapping = project.project_features
                        .joins(:responsible_assignments)
                        .where(feature_assignments: { user_id: responsible_user_ids, role: 'responsible' })
                        .where.not(id: id)
                        .where('start_date <= ? AND end_date >= ?', end_date, start_date)
    
    overlapping
  end

  # Adjust dates to prevent overlapping with other features
  def adjust_dates_to_prevent_overlap
    return if responsible_contributors.empty?
    
    responsible_user_ids = responsible_contributors.pluck(:id)
    
    # Get all features for the same responsible contributors, sorted by start date
    existing_features = project.project_features
                              .joins(:responsible_assignments)
                              .where(feature_assignments: { user_id: responsible_user_ids, role: 'responsible' })
                              .where.not(id: id)
                              .order(:start_date)
    
    # Find the latest end date among existing features
    latest_end_date = existing_features.maximum(:end_date)
    
    if latest_end_date && start_date <= latest_end_date
      # Set start date to the day after the latest end date
      new_start_date = latest_end_date + 1.day
      self.start_date = new_start_date
      self.end_date = new_start_date + duration.days
    end
  end

  # More comprehensive method to prevent overlaps by adjusting all affected features
  def prevent_overlaps_for_responsible_contributors
    return if responsible_contributors.empty?
    
    # Use a transaction to ensure data consistency
    ActiveRecord::Base.transaction do
      responsible_user_ids = responsible_contributors.pluck(:id)
      
      # Get all features for the same responsible contributors, including this one
      all_features = project.project_features
                           .joins(:responsible_assignments)
                           .where(feature_assignments: { user_id: responsible_user_ids, role: 'responsible' })
                           .order(:start_date, :id)
      
      # Adjust dates sequentially to prevent overlaps
      current_date = nil
      all_features.each do |feature|
        next if feature.duration.nil?
        if current_date.nil?
          # First feature starts at its original start date
          current_date = feature.start_date
        else
          # Subsequent features start after the previous one ends
          feature.start_date = current_date
          feature.end_date = current_date + feature.duration.days
          feature.save if feature.changed?
          current_date = feature.end_date + 1.day
        end
      end
      
      # After adjustment, delete any features that still overlap (but not the current feature)
      last_end = nil
      all_features.reload.sort_by { |f| [f.start_date, f.id] }.each do |feature|
        if last_end && feature.start_date <= last_end
          # Don't delete the current feature being updated
          feature.destroy unless feature.id == self.id
        else
          last_end = feature.end_date
        end
      end
    end
  rescue => e
    Rails.logger.error "Error in prevent_overlaps_for_responsible_contributors: #{e.message}"
    # Don't re-raise the error to avoid breaking the update process
  end

  after_initialize :set_default_status, if: :new_record?

  # Class method to adjust all features for a specific responsible contributor
  def self.adjust_all_for_responsible_contributor(user_id, project_id)
    features = ProjectFeature.joins(:responsible_assignments)
                            .where(feature_assignments: { user_id: user_id, role: 'responsible' })
                            .where(project_id: project_id)
                            .order(:start_date, :id)
    
    return if features.empty?
    
    # Adjust dates sequentially to prevent overlaps
    current_date = nil
    features.each do |feature|
      next if feature.duration.nil?
      if current_date.nil?
        # First feature starts at its original start date
        current_date = feature.start_date
      else
        # Subsequent features start after the previous one ends
        feature.start_date = current_date
        feature.end_date = current_date + feature.duration.days
        feature.save if feature.changed?
        current_date = feature.end_date + 1.day
      end
    end
    # After adjustment, delete any features that still overlap
    last_end = nil
    features.reload.sort_by { |f| [f.start_date, f.id] }.each do |feature|
      if last_end && feature.start_date <= last_end
        feature.destroy
      else
        last_end = feature.end_date
      end
    end
  end

  # Class method to update status for all features based on their dates
  def self.update_all_statuses_from_dates!
    ProjectFeature.find_each do |feature|
      feature.update_status_from_dates!
    end
  end

  private

  def set_default_status
    self.status ||= 'not_started'
  end

  def set_start_date
    self.start_date ||= Date.today
  end

  def set_end_date
    # Only recalculate end_date from duration if:
    # 1. Duration is present
    # 2. Start date is present
    # 3. End date is nil or not explicitly being set
    return unless duration.present? && start_date.present?
    
    # If end_date is being set manually (not nil and was explicitly changed), don't recalculate
    # This allows manual date editing to take precedence over duration-based calculation
    return if end_date.present? && end_date_changed?
    
    # Recalculate end_date from duration and start_date
    self.end_date = start_date + duration.days
  end

  def adjust_overlapping_features
    # This method will be called after saving to adjust other features if needed
    # For now, we'll focus on preventing overlap during creation/update
  end

  def adjust_dates_if_duration_changed
    # Check if duration was changed
    if saved_change_to_duration? && responsible_contributors.any?
      # Recalculate end date based on new duration
      self.end_date = start_date + duration.days
      save if changed?
      
      # Note: Overlap prevention is now handled manually in the controller
      # to avoid foreign key constraint issues
    end
  end

  def update_status_from_dates
    # Disabled automatic status updates - users can set status manually
    # This allows project creators to set the initial status themselves
    # and prevents conflicts with the overdue warning system
    return
  end


  # Create notifications for overdue features
  def create_overdue_notifications
    return unless overdue? && (saved_change_to_end_date? || saved_change_to_status?)
    
    # Notify responsible contributors about overdue features
    responsible_contributors.each do |user|
      Notification.create_for_overdue_feature(self, user, 'responsible')
    end
    
    # Notify accountable contributors about overdue features
    accountable_contributors.each do |user|
      Notification.create_for_overdue_feature(self, user, 'accountable')
    end
  end
end
