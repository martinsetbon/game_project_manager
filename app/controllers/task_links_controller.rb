class TaskLinksController < ApplicationController
  before_action :set_project
  before_action :set_task
  before_action :check_permissions

  def create
    source_task = @project.tasks.find_by(id: params[:source_task_id])
    anchor_day = params[:anchor_day].to_i
    align_now = params[:align_now].to_s == 'true'

    unless source_task && anchor_day.positive?
      render json: { status: 'error', errors: ['Invalid link parameters'] }, status: :unprocessable_entity
      return
    end

    if source_task.id == @task.id
      render json: { status: 'error', errors: ['Cannot link a task to itself'] }, status: :unprocessable_entity
      return
    end

    @task.incoming_task_link&.destroy

    link = TaskLink.new(
      source_task: source_task,
      target_task: @task,
      anchor_day: anchor_day
    )

    if link.save
      if @task.start_date && @task.end_date && source_task.start_date
        aligned_start = source_task.start_date + (anchor_day - 1).days
        offset_days = (@task.start_date - aligned_start).to_i
        link.update_columns(offset_days: offset_days, updated_at: Time.current)

        if align_now
          duration = (@task.end_date - @task.start_date).to_i
          link.update_columns(offset_days: 0, updated_at: Time.current)
          @task.update_columns(
            start_date: aligned_start,
            end_date: aligned_start + duration.days,
            updated_at: Time.current
          )
        end
      end

      render json: {
        status: 'success',
        link: {
          id: link.id,
          source_task_id: source_task.id,
          source_task_name: source_task.name,
          anchor_day: link.anchor_day,
          offset_days: link.offset_days
        }
      }
    else
      render json: { status: 'error', errors: link.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    link =
      if params[:id].present? && params[:id].to_s != '0'
        TaskLink.find_by(id: params[:id].to_i)
      else
        @task.incoming_task_link
      end

    unless link
      render json: { status: 'error', errors: ['Link not found'] }, status: :not_found
      return
    end

    unless link.source_task_id == @task.id || link.target_task_id == @task.id
      render json: { status: 'error', errors: ['Link not found'] }, status: :not_found
      return
    end

    unless link.source_task.project_id == @project.id
      render json: { status: 'error', errors: ['Link not found'] }, status: :not_found
      return
    end

    link.destroy
    render json: { status: 'success' }
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task
    @task = @project.tasks.find(params[:task_id])
  end

  def check_permissions
    unless can_edit_task?
      render json: { status: 'error', errors: ['You do not have permission to edit this task.'] }, status: :unauthorized
    end
  end

  def can_edit_task?
    return true if @project.user == current_user

    @task.responsible_users.include?(current_user) || @task.accountable_users.include?(current_user)
  end
end

