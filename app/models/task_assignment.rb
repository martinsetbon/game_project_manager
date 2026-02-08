# app/models/task_assignment.rb
class TaskAssignment < ApplicationRecord
  belongs_to :user
  belongs_to :task

  ROLES = %w[responsible accountable].freeze
  validates :role, presence: true, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: [:task_id, :role], message: "is already assigned to this task with this role" }

  scope :responsible, -> { where(role: 'responsible') }
  scope :accountable, -> { where(role: 'accountable') }

  # Create notification when assignment is created
  after_create :create_assignment_notification

  private

  def create_assignment_notification
    # Similar to FeatureAssignment, create notification for task assignment
    # You can implement this later if needed
  end
end

