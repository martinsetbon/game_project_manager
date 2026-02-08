class ProjectsController < ApplicationController
  before_action :set_project, only: [:show, :edit, :update, :destroy, :timeline_data, :extend_stand_by_features]
  before_action :authenticate_user!
  before_action :check_project_permissions, only: [:edit, :update, :destroy]

  def index
    @owned_projects = current_user.projects
    @contributed_projects = current_user.contributed_projects
  end

  def show
    @project_features = @project.project_features.includes(
      responsible_assignments: :user, 
      accountable_assignments: :user
    )
    @project_tasks = @project.tasks.includes(
      responsible_assignments: :user,
      accountable_assignments: :user
    ).ordered
    @contributors = @project.contributors.includes(:avatar_attachment)
    # Load all users for task assignment (including project owner)
    @all_users = User.all
    
    # Get friend IDs for current user (people who have worked together on projects)
    friend_ids = current_user.contributed_projects.joins(:project_contributors)
                             .where.not(project_contributors: { user_id: current_user.id })
                             .pluck('project_contributors.user_id')
                             .uniq
    
    # Also include people who contributed to current user's projects
    friend_ids += current_user.projects.joins(:project_contributors)
                              .pluck('project_contributors.user_id')
                              .uniq
    
    @friend_ids = friend_ids.uniq.compact
  end

  def new
    @project = current_user.projects.build
    @users = User.where.not(id: current_user.id) # Load all users except current user
  end

  def create
    @project = current_user.projects.build(project_params)
    @project.start_date ||= Date.today

    if @project.save
      redirect_to @project, notice: "Project was successfully created."
    else
      @users = User.where.not(id: current_user.id) # Reload users in case of validation failure
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @users = User.where.not(id: current_user.id) # Load all users except current user
  end

  def update
    # Handle field updates from inline editing
    if params[:field].present?
      field_name = params[:field]
      
      # Handle background image upload
      if field_name == 'background_image'
        if params[:project] && params[:project][:background_image]
          @project.background_image.attach(params[:project][:background_image])
          redirect_to @project, notice: 'Background image updated successfully'
        else
          redirect_to @project, alert: 'No image selected'
        end
        return
      end
      
      # Handle other field updates
      if params[:value].present?
        case field_name
        when 'description'
          @project.description = params[:value]
        when 'start_date'
          @project.start_date = Date.parse(params[:value]) rescue nil
        when 'end_date'
          @project.end_date = Date.parse(params[:value]) rescue nil
        when 'budget'
          @project.budget = params[:value]
          @project.currency = params[:currency] if params[:currency].present?
        end
        
        if @project.save(validate: false)
          render json: { status: 'success', value: @project.send(field_name) }
        else
          render json: { status: 'error', errors: @project.errors.full_messages }, status: :unprocessable_entity
        end
        return
      end
    end
    
    # Regular update from edit form
    if @project.update(project_params)
      redirect_to @project, notice: "Project was successfully updated."
    else
      @users = User.where.not(id: current_user.id) # Reload users in case of validation failure
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project.destroy
    redirect_to projects_path, notice: "Project was successfully deleted."
  end

  def team
    @project = Project.find(params[:id])
  end

  def timeline_data
    year = params[:year]&.to_i || 2025
    month = params[:month]&.to_i
    view = params[:view] || 'year'

    features = @project.project_features.includes(:responsible_assignments, :responsible_contributors)

    if view == 'year'
      # Filter features longer than 1 month for year view
      features = features.select do |feature|
        next false unless feature.start_date && feature.end_date
        duration = (feature.end_date - feature.start_date).to_i
        duration >= 30 # At least 30 days (1 month)
      end
    elsif view == 'month' && month
      # Show ALL features that overlap with the specified month
      month_start = Date.new(year, month, 1)
      month_end = month_start.end_of_month
      
      features = features.select do |feature|
        next false unless feature.start_date && feature.end_date
        feature.start_date <= month_end && feature.end_date >= month_start
      end
    end

    # Format features for JSON response
    formatted_features = features.map do |feature|
      {
        id: feature.id,
        name: feature.name,
        start_date: feature.start_date,
        end_date: feature.end_date,
        status: feature.status,
        responsible_contributor_id: feature.responsible_contributors.first&.id,
        overdue: feature.overdue?
      }
    end

    render json: { features: formatted_features }
  end

  def extend_stand_by_features
    # Manual trigger for stand-by extension
    begin
      # Debug: Check all features first
      all_features = @project.project_features
      stand_by_features = @project.project_features.where(status: 'stand_by')
      stand_by_with_start_time = @project.project_features.where(status: 'stand_by')
                                 .where.not(stand_by_started_at: nil)
      
      # Debug info
      Rails.logger.info "DEBUG: Total features: #{all_features.count}"
      Rails.logger.info "DEBUG: Stand-by features: #{stand_by_features.count}"
      Rails.logger.info "DEBUG: Stand-by with start time: #{stand_by_with_start_time.count}"
      
      all_features.each do |f|
        Rails.logger.info "DEBUG: Feature '#{f.name}' - Status: #{f.status}, Stand-by started: #{f.stand_by_started_at}"
      end
      
      extended_count = 0
      stand_by_with_start_time.each do |feature|
        old_end_date = feature.end_date
        old_start_date = feature.start_date
        
        # Calculate days manually
        days_in_stand_by = (Date.current - feature.stand_by_started_at.to_date).to_i
        
        # If no days to extend, try setting stand_by_started_at to a week ago
        if days_in_stand_by <= 0
          feature.update!(stand_by_started_at: 7.days.ago)
          days_in_stand_by = 7
        end
        
        if days_in_stand_by > 0
          # Update the duration instead of end_date to work with the model callbacks
          new_duration = feature.duration + days_in_stand_by
          
          # Update the feature with explicit values
          feature.duration = new_duration
          feature.stand_by_started_at = Time.current
          
          if feature.save
            extended_count += 1
            # Debug: Check what was actually saved
            feature.reload
            puts "DEBUG: Feature '#{feature.name}' - Old duration: #{feature.duration - days_in_stand_by}, New duration: #{feature.duration}"
            puts "DEBUG: Days extended: #{days_in_stand_by}"
            puts "DEBUG: New end date: #{feature.end_date}"
          else
            puts "DEBUG: Failed to save feature: #{feature.errors.full_messages}"
          end
        end
      end
      
      redirect_to @project, notice: "Extended #{extended_count} stand-by features successfully. (Found #{stand_by_features.count} stand-by features, #{stand_by_with_start_time.count} with start time)"
    rescue => e
      redirect_to @project, alert: "Error extending stand-by features: #{e.message}"
    end
  end

  private

  def set_project
    @project = Project.find(params[:id])
  end

  def check_project_permissions
    unless @project.user == current_user
      redirect_to projects_path, alert: 'You do not have permission to perform this action on this project.'
    end
  end

  def project_params
    params.require(:project).permit(:name, :description, :start_date, :end_date, :budget, :currency, :background_image, contributor_ids: [])
  end
end
