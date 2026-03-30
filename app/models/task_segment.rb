class TaskSegment < ApplicationRecord
  belongs_to :task

  validates :name, presence: true
  validates :start_day, presence: true, numericality: { greater_than: 0 }
  validates :end_day, presence: true, numericality: { greater_than_or_equal_to: :start_day }
  validate :days_within_task_duration
  validate :no_overlapping_segments

  private

  def days_within_task_duration
    return unless task&.start_date && task&.end_date

    duration = (task.end_date - task.start_date).to_i + 1
    if start_day > duration || end_day > duration
      errors.add(:base, "Segment days must be within task duration (#{duration} days)")
    end
  end

  def no_overlapping_segments
    return unless task && start_day && end_day

    overlapping = task.task_segments.where.not(id: id).any? do |segment|
      (start_day <= segment.end_day) && (segment.start_day <= end_day)
    end

    if overlapping
      errors.add(:base, "Segment overlaps with an existing segment. Please delete the existing segment first.")
    end
  end
end

