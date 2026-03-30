class TaskCheckpointsController < ApplicationController
  before_action :set_project
  before_action :set_task
  before_action :set_task_checkpoint, only: [:update, :destroy]
  before_action :check_permissions

  def create
    begin
      permitted_params = checkpoint_params

      if permitted_params[:day].blank?
        render json: { status: 'error', errors: ['Day parameter is required'] }, status: :unprocessable_entity
        return
      end

      @checkpoint = @task.task_checkpoints.build(permitted_params)

      if @checkpoint.save
        render json: {
          status: 'success',
          checkpoint: {
            id: @checkpoint.id,
            day: @checkpoint.day,
            notified: @checkpoint.notified
          }
        }
      else
        errors = @checkpoint.errors.full_messages
        errors = ['Validation failed'] if errors.empty?
        render json: { status: 'error', errors: errors }, status: :unprocessable_entity
      end
    rescue ActionController::ParameterMissing => e
      render json: { status: 'error', errors: ["Missing parameter: #{e.message}"] }, status: :unprocessable_entity
    rescue => e
      render json: { status: 'error', errors: [e.message] }, status: :unprocessable_entity
    end
  end

  def destroy
    @checkpoint.destroy
    render json: { status: 'success' }
  end

  def update
    if @checkpoint.update(checkpoint_params)
      render json: {
        status: 'success',
        checkpoint: {
          id: @checkpoint.id,
          day: @checkpoint.day,
          name: @checkpoint.name
        }
      }
    else
      render json: { status: 'error', errors: @checkpoint.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task
    @task = @project.tasks.find(params[:task_id])
  end

  def set_task_checkpoint
    @checkpoint = @task.task_checkpoints.find(params[:id])
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

  def checkpoint_params
    cp_params = params.require(:task_checkpoint).permit(:day, :name)
    cp_params[:day] = cp_params[:day].to_i if cp_params[:day].present?
    cp_params
  end
end

