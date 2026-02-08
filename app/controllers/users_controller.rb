class UsersController < ApplicationController
  before_action :authenticate_user!

  def index
    # Only search if there's a search parameter or filters
    @users = User.where.not(id: current_user.id).includes(:avatar_attachment)
    @has_search = false
    
    # Only perform search if there's a search term or filters
    if params[:search].present? || params[:title].present? || params[:country].present?
      @has_search = true
      
      # Apply search filter
      if params[:search].present?
        @users = @users.where("name ILIKE ? OR email ILIKE ?", 
                             "%#{params[:search]}%", 
                             "%#{params[:search]}%")
      end
      
      # Apply filters
      if params[:title].present?
        @users = @users.where("job ILIKE ?", "%#{params[:title]}%")
      end
      
      if params[:country].present?
        @users = @users.where("country ILIKE ?", "%#{params[:country]}%")
      end
      
      @users = @users.order(:name)
    else
      @users = User.none # Empty relation - no users shown by default
    end
    
    # Get friends (for now, using project contributors - people user has worked with)
    # In the future, this can be replaced with a proper friendship system
    friend_ids = current_user.contributed_projects.joins(:project_contributors)
                             .where.not(project_contributors: { user_id: current_user.id })
                             .pluck('project_contributors.user_id')
                             .uniq
    
    # Also include people who contributed to current user's projects
    friend_ids += current_user.projects.joins(:project_contributors)
                              .pluck('project_contributors.user_id')
                              .uniq
    
    friend_ids = friend_ids.uniq.compact
    
    @friends = User.where(id: friend_ids).includes(:avatar_attachment)
    
    # Apply friends search
    if params[:friend_search].present?
      @friends = @friends.where("name ILIKE ? OR email ILIKE ?",
                                "%#{params[:friend_search]}%",
                                "%#{params[:friend_search]}%")
    end
    
    # Separate online/offline friends (using available field for now)
    # In the future, this can be based on last_seen_at or similar
    @online_friends = @friends.where(available: true).order(:name)
    @offline_friends = @friends.where.not(available: true).or(@friends.where(available: nil)).order(:name)
    
    # Get unique countries and jobs for filter dropdowns
    @countries = User.where.not(country: [nil, '']).distinct.pluck(:country).compact.sort
    @titles = User.where.not(job: [nil, '']).distinct.pluck(:job).compact.sort
  end
end

