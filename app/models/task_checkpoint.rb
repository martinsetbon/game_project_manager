class TaskCheckpoint < ApplicationRecord
  belongs_to :task

  validates :day, presence: true, numericality: { greater_than: 0 }
  validates :day, uniqueness: { scope: :task_id, message: "Checkpoint already exists for this day" }
  validate :day_within_task_duration

  private

  def day_within_task_duration
    return unless task&.start_date && task&.end_date
    return unless day.present?

    duration = (task.end_date - task.start_date).to_i + 1
    if day > duration
      errors.add(:day, "must be within task duration (#{duration} days)")
    end
    if day < 1
      errors.add(:day, "must be greater than 0")
    end
  end
end

