class TaskLink < ApplicationRecord
  belongs_to :source_task, class_name: 'Task'
  belongs_to :target_task, class_name: 'Task'

  validates :anchor_day, presence: true, numericality: { greater_than: 0 }
  validate :different_tasks

  private

  def different_tasks
    return unless source_task_id && target_task_id
    if source_task_id == target_task_id
      errors.add(:base, 'Source and target tasks must be different')
    end
  end
end

