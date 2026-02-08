class NotificationsController < ApplicationController
  before_action :authenticate_user!

  def index
    all_notifications = current_user.notifications.includes(:project, :project_feature).order(created_at: :desc)
    two_days_ago = 2.days.ago
    
    @new_notifications = all_notifications.where("created_at >= ?", two_days_ago)
    @past_notifications = all_notifications.where("created_at < ?", two_days_ago)
  end

  def mark_as_viewed
    @notification = current_user.notifications.find(params[:id])
    @notification.mark_as_viewed!
    
    render json: { success: true, viewed: @notification.viewed }
  end
end
