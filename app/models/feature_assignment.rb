# app/models/feature_assignment.rb
class FeatureAssignment < ApplicationRecord
  belongs_to :user
  belongs_to :project_feature

  ROLES = %w[responsible accountable].freeze
  validates :role, presence: true, inclusion: { in: ROLES }

  scope :responsible, -> { where(role: 'responsible') }
  scope :accountable, -> { where(role: 'accountable') }

  validate :warn_same_user_assignment, if: -> { role == 'accountable' && same_user_responsible? }

  private

  def same_user_responsible?
    project_feature.feature_assignments.where(role: 'responsible').exists?(user_id: user_id)
  end

  def warn_same_user_assignment
    if same_user_responsible?
      errors.add(:base, "Warning: This user is already assigned as responsible. Having the same user as both responsible and accountable is not recommended.")
    end
  end
end
