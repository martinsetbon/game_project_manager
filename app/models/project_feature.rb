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
  after_save :adjust_overlapping_features
  after_update :adjust_dates_if_duration_changed

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
    # After adjustment, delete any features that still overlap
    last_end = nil
    all_features.reload.sort_by { |f| [f.start_date, f.id] }.each do |feature|
      if last_end && feature.start_date <= last_end
        feature.destroy
      else
        last_end = feature.end_date
      end
    end
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
      
      # Adjust all features for the same responsible contributors to prevent overlaps
      prevent_overlaps_for_responsible_contributors
    end
  end
end
