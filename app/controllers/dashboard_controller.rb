class DashboardController < ApplicationController
  before_action :authenticate_user!

  def index
    # Load all dashboard data
    @my_projects = current_user.projects.includes(:project_features, :notifications).order(created_at: :desc)
    @contributing_projects = get_contributing_projects
    @notifications = get_user_notifications
    
    # Calculate stats
    @active_features_count = get_active_features_count
    @pending_requests_count = get_pending_requests_count
    @overdue_features_count = get_overdue_features_count
    @upcoming_features_count = get_upcoming_features_count
    @news_count = get_news_count
    
    # Load new dashboard structure
    @current_tasks = get_current_tasks
    @incoming_tasks = get_incoming_tasks
    @backlog_tasks = get_backlog_tasks
    @activity_history = get_activity_history
  end

  def tab_content
    @active_tab = params[:tab]
    
    case @active_tab
    when 'my_projects'
      @my_projects = current_user.projects.includes(:project_features).order(created_at: :desc)
    when 'contributing'
      @contributing_projects = get_contributing_projects
    when 'notifications'
      @notifications = get_user_notifications
      mark_notifications_as_read
    when 'chat'
      # Future chat implementation
    end
    
    render partial: "dashboard/#{@active_tab}_tab", locals: {
      my_projects: @my_projects,
      contributing_projects: @contributing_projects,
      notifications: @notifications
    }
  end

  def counts
    # Return updated counts as JSON for AJAX requests
    contributing_projects = get_contributing_projects
    unread_notifications_count = current_user.notifications.unread.count
    contributing_projects_count = contributing_projects.count
    
    unviewed_notifications_count = current_user.notifications.unviewed.count
    
    render json: {
      my_projects_count: current_user.projects.count,
      contributing_projects_count: contributing_projects_count,
      unread_notifications_count: unread_notifications_count,
      unviewed_notifications_count: unviewed_notifications_count
    }
  end

  def move_task_to_backlog
    Rails.logger.info "move_task_to_backlog called with params: #{params.inspect}"
    task_type = params[:task_type]
    task_id = params[:task_id]
    feature_id = params[:feature_id]
    task_name = params[:task_name]

    begin
      if task_type == 'task' && task_id.present?
        # Move an existing Task to backlog
        task = Task.find(task_id)
        
        # Check permissions
        unless task.can_change_status?(current_user) || task.project&.user == current_user
          render json: { status: 'error', errors: ['You do not have permission to move this task'] }, status: :unauthorized
          return
        end
        
        # Move task to backlog by clearing dates and setting backlog_type
        task.update!(
          start_date: nil,
          end_date: nil,
          backlog_type: task.project_id.present? ? 'project' : 'user',
          backlog_user_id: task.project_id.blank? ? current_user.id : nil
        )
        
        render json: { status: 'success', message: 'Task moved to backlog successfully' }
      elsif task_type == 'feature' && feature_id.present?
        # Create a new Task from a feature and add it to backlog
        feature = ProjectFeature.find(feature_id)
        
        # Check permissions - user must be project manager or assigned to the feature
        unless feature.project.user == current_user || feature.feature_assignments.exists?(user_id: current_user.id)
          render json: { status: 'error', errors: ['You do not have permission to create a task from this feature'] }, status: :unauthorized
          return
        end
        
        # Create a task from the feature
        task = Task.create!(
          name: task_name.presence || feature.name,
          project_id: feature.project_id,
          project_feature_id: feature.id,
          status: 'not_started',
          backlog_type: 'project',
          start_date: nil,
          end_date: nil
        )
        
        # Copy assignments from feature to task if user is responsible/accountable
        feature.feature_assignments.where(user_id: current_user.id).each do |assignment|
          task.task_assignments.create!(
            user_id: current_user.id,
            role: assignment.role == 'responsible' ? 'responsible' : 'accountable'
          )
        end
        
        render json: { status: 'success', message: 'Task created and added to backlog successfully', task_id: task.id }
      else
        render json: { status: 'error', errors: ['Invalid task data provided'] }, status: :unprocessable_entity
      end
    rescue ActiveRecord::RecordNotFound => e
      render json: { status: 'error', errors: ['Task or feature not found'] }, status: :not_found
    rescue => e
      Rails.logger.error "Error moving task to backlog: #{e.message}"
      render json: { status: 'error', errors: [e.message] }, status: :unprocessable_entity
    end
  end

  private

  def get_contributing_projects
    # Get projects where user is a contributor (responsible or accountable)
    project_ids = current_user.feature_assignments
                              .joins(:project_feature)
                              .pluck('project_features.project_id')
                              .uniq
    
    Project.includes(:project_features, :user)
           .where(id: project_ids)
           .where.not(user: current_user) # Exclude projects created by user
           .order(created_at: :desc)
  end

  def get_user_notifications
    # Get notifications from database
    notifications = current_user.notifications
                                .includes(:project, :project_feature)
                                .recent
                                .limit(50) # Limit to recent 50 notifications
    
    Rails.logger.info "Dashboard: Found #{notifications.count} notifications for user #{current_user.email}"
    notifications.each do |notification|
      Rails.logger.info "  - #{notification.notification_type}: #{notification.title}"
    end
    
    notifications
  end

  def mark_notifications_as_read
    # Mark all unread notifications as read when user views the notifications tab
    current_user.notifications.unread.update_all(read: true)
    Rails.logger.info "Marked all notifications as read for user #{current_user.email}"
  end

  # Stats calculation methods
  def get_active_features_count
    current_user.feature_assignments
                .joins(:project_feature)
                .where(project_features: { status: 'work_in_progress' })
                .count
  end

  def get_pending_requests_count
    current_user.feature_assignments
                .joins(:project_feature)
                .where(project_features: { approval_requested: true })
                .count
  end

  def get_overdue_features_count
    current_user.feature_assignments
                .joins(:project_feature)
                .where('project_features.end_date < ? AND project_features.status IN (?)', 
                       Date.current, ['not_started', 'work_in_progress'])
                .count
  end

  def get_upcoming_features_count
    current_user.feature_assignments
                .joins(:project_feature)
                .where('project_features.start_date BETWEEN ? AND ?', 
                       Date.current, Date.current + 2.days)
                .count
  end

  def get_news_count
    current_user.notifications.unviewed.count
  end

  # New dashboard structure methods
  def get_current_tasks
    tasks = []
    
    # Approval requests (urgent)
    approval_requests = current_user.feature_assignments
                                    .joins(:project_feature)
                                    .includes(project_feature: [:project])
                                    .where(project_features: { approval_requested: true })
                                    .where(feature_assignments: { role: 'accountable' })
    
    approval_requests.each do |assignment|
      tasks << {
        type: 'approval_request',
        priority: 'high',
        feature: assignment.project_feature,
        assignment: assignment,
        due_date: Date.current,
        warning: nil
      }
    end
    
    # Overdue features
    overdue_features = current_user.feature_assignments
                                   .joins(:project_feature)
                                   .includes(project_feature: [:project])
                                   .where('project_features.end_date < ? AND project_features.status IN (?)', 
                                          Date.current, ['not_started', 'work_in_progress'])
    
    overdue_features.each do |assignment|
      days_overdue = (Date.current - assignment.project_feature.end_date).to_i
      tasks << {
        type: 'overdue_feature',
        priority: 'high',
        feature: assignment.project_feature,
        assignment: assignment,
        due_date: assignment.project_feature.end_date,
        warning: "Overdue by #{days_overdue} day#{'s' if days_overdue != 1}"
      }
    end
    
    # Features ending soon (within 2 days)
    overdue_feature_ids = overdue_features.pluck(:id)
    ending_soon = current_user.feature_assignments
                              .joins(:project_feature)
                              .includes(project_feature: [:project])
                              .where('project_features.end_date BETWEEN ? AND ? AND project_features.status IN (?)',
                                     Date.current, Date.current + 2.days, ['not_started', 'work_in_progress'])
                              .where.not(id: overdue_feature_ids)
    
    ending_soon.each do |assignment|
      days_until_end = (assignment.project_feature.end_date - Date.current).to_i
      warning = days_until_end == 0 ? "Ending today!" : "Ending in #{days_until_end} day#{'s' if days_until_end != 1}"
      tasks << {
        type: 'ending_soon',
        priority: days_until_end == 0 ? 'high' : 'normal',
        feature: assignment.project_feature,
        assignment: assignment,
        due_date: assignment.project_feature.end_date,
        warning: warning
      }
    end
    
    # Checkpoints needing attention (within 1 day)
    upcoming_checkpoints = FeatureCheckpoint.joins(project_feature: :feature_assignments)
                                           .where(feature_assignments: { user_id: current_user.id, role: 'accountable' })
                                           .includes(project_feature: [:project])
                                           .where('project_features.start_date IS NOT NULL')
    
    upcoming_checkpoints.each do |checkpoint|
      feature = checkpoint.project_feature
      checkpoint_date = feature.start_date + (checkpoint.day - 1).days
      days_until_checkpoint = (checkpoint_date - Date.current).to_i
      
      if days_until_checkpoint >= 0 && days_until_checkpoint <= 1
        warning = days_until_checkpoint == 0 ? "Check needed today!" : "Check needed tomorrow"
        tasks << {
          type: 'checkpoint',
          priority: days_until_checkpoint == 0 ? 'high' : 'normal',
          feature: feature,
          checkpoint: checkpoint,
          checkpoint_date: checkpoint_date,
          due_date: checkpoint_date,
          warning: warning
        }
      end
    end
    
    # Sort by priority (high first) and due date
    tasks.sort_by { |t| [t[:priority] == 'high' ? 0 : 1, t[:due_date]] }
  end

  def get_incoming_tasks
    tasks = []
    
    # Features starting soon (future start dates)
    upcoming_features = current_user.feature_assignments
                                    .joins(:project_feature)
                                    .includes(project_feature: [:project])
                                    .where('project_features.start_date > ?', Date.current)
                                    .where(project_features: { status: ['not_started', 'work_in_progress'] })
    
    upcoming_features.each do |assignment|
      days_until_start = (assignment.project_feature.start_date - Date.current).to_i
      warning = days_until_start <= 1 ? (days_until_start == 0 ? "Starting today!" : "Starting tomorrow") : nil
      tasks << {
        type: 'upcoming_feature',
        priority: days_until_start <= 1 ? 'normal' : 'low',
        feature: assignment.project_feature,
        assignment: assignment,
        start_date: assignment.project_feature.start_date,
        due_date: assignment.project_feature.start_date,
        warning: warning
      }
    end
    
    # Future checkpoints (more than 1 day away)
    future_checkpoints = FeatureCheckpoint.joins(project_feature: :feature_assignments)
                                         .where(feature_assignments: { user_id: current_user.id, role: 'accountable' })
                                         .includes(project_feature: [:project])
                                         .where('project_features.start_date IS NOT NULL')
    
    future_checkpoints.each do |checkpoint|
      feature = checkpoint.project_feature
      checkpoint_date = feature.start_date + (checkpoint.day - 1).days
      days_until_checkpoint = (checkpoint_date - Date.current).to_i
      
      if days_until_checkpoint > 1
        warning = days_until_checkpoint <= 3 ? "Check in #{days_until_checkpoint} days" : nil
        tasks << {
          type: 'checkpoint',
          priority: 'low',
          feature: feature,
          checkpoint: checkpoint,
          checkpoint_date: checkpoint_date,
          due_date: checkpoint_date,
          warning: warning
        }
      end
    end
    
    # Sort chronologically by due_date/start_date
    tasks.sort_by { |t| t[:due_date] || t[:start_date] || Date.today + 365 }
  end

  def get_backlog_tasks
    # Get backlog tasks for current user
    # User backlog tasks
    user_backlog = Task.user_backlog(current_user.id)
                      .includes(:project, :responsible_users, :accountable_users)
                      .order(created_at: :desc)
    
    # Project backlog tasks from projects where user is PM or contributor
    project_ids = current_user.projects.pluck(:id)
    project_ids += current_user.feature_assignments
                              .joins(:project_feature)
                              .pluck('project_features.project_id')
                              .uniq
    
    project_backlog = Task.where(backlog_type: 'project', project_id: project_ids)
                         .includes(:project, :responsible_users, :accountable_users)
                         .order(created_at: :desc)
    
    # Combine and format, then sort by created_at DESC (latest first)
    (user_backlog + project_backlog).uniq
      .sort_by { |t| t.created_at || Time.at(0) }
      .reverse
      .map do |task|
      {
        type: 'backlog_task',
        task: task,
        priority: task.priority || 'medium',
        status: task.status,
        overdue: false, # Backlog tasks are never overdue
        created_at: task.created_at
      }
    end
  end

  def get_activity_history
    # Mock data for now - in real app this would come from an activity log
    []
  end
end
