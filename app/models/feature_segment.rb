class FeatureSegment < ApplicationRecord
  belongs_to :project_feature

  validates :name, presence: true
  validates :start_day, presence: true, numericality: { greater_than: 0 }
  validates :end_day, presence: true, numericality: { greater_than_or_equal_to: :start_day }
  validate :days_within_feature_duration
  validate :no_overlapping_segments

  private

  def days_within_feature_duration
    return unless project_feature&.start_date && project_feature&.end_date

    duration = (project_feature.end_date - project_feature.start_date).to_i + 1
    if start_day > duration || end_day > duration
      errors.add(:base, "Segment days must be within feature duration (#{duration} days)")
    end
  end

  def no_overlapping_segments
    return unless project_feature && start_day && end_day

    overlapping = project_feature.feature_segments.where.not(id: id).any? do |segment|
      # Check if segments overlap
      # Two segments overlap if: (start1 <= end2) && (start2 <= end1)
      (start_day <= segment.end_day) && (segment.start_day <= end_day)
    end

    if overlapping
      errors.add(:base, "Segment overlaps with an existing segment. Please delete the existing segment first.")
    end
  end
end

