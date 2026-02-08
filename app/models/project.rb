class Project < ApplicationRecord
  belongs_to :user # owner
  has_many :project_features, dependent: :destroy
  has_many :tasks, dependent: :destroy

  has_many :project_contributors, dependent: :destroy
  has_many :contributors, through: :project_contributors, source: :user
  has_many :notifications, dependent: :destroy

  # ActiveStorage attachment for background image
  has_one_attached :background_image

  validates :name, :description, presence: true
  before_create :set_default_start_date

  private

  def set_default_start_date
    self.start_date ||= Date.today
  end
end
