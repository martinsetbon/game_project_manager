class BacklogController < ApplicationController
  before_action :authenticate_user!
  
  def index
    # Get user backlog tasks (tasks with backlog_type = 'user' AND backlog_user_id = current_user)
    # Order by created_at DESC (latest first)
    user_backlog_tasks = Task.user_backlog(current_user.id).order(created_at: :desc)
    
    # Get tasks assigned to current user (via task_assignments) - these should also appear in "my backlog"
    # This includes tasks where user is responsible or accountable, regardless of backlog_type
    assigned_task_ids = TaskAssignment.where(user_id: current_user.id).pluck(:task_id)
    assigned_tasks = Task.where(id: assigned_task_ids)
                        .where.not(id: user_backlog_tasks.pluck(:id)) # Exclude duplicates
                        .order(created_at: :desc)
    
    # Combine user backlog tasks and assigned tasks, sort by created_at DESC (latest first)
    @user_backlog_tasks = (user_backlog_tasks + assigned_tasks).uniq.sort_by { |t| t.created_at || Time.at(0) }.reverse
    
    # Get project backlog tasks (only if user is project creator)
    # Order by created_at DESC (latest first)
    @project_backlog_tasks = {}
    current_user.projects.each do |project|
      @project_backlog_tasks[project.id] = {
        project: project,
        tasks: Task.project_backlog(project.id).order(created_at: :desc)
      }
    end
    
    # Get all projects for display
    @projects = current_user.projects.order(:name)
  end
end

