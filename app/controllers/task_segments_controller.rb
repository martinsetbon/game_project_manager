class TaskSegmentsController < ApplicationController
  before_action :set_project
  before_action :set_task
  before_action :set_task_segment, only: [:update, :destroy]
  before_action :check_permissions

  def create
    @segment = @task.task_segments.build(segment_params)
    apply_default_percent_if_missing(@segment)

    if @segment.save
      render json: {
        status: 'success',
        segment: {
          id: @segment.id,
          name: @segment.name,
          start_day: @segment.start_day.to_f,
          end_day: @segment.end_day.to_f,
          color: @segment.color,
          default_percent: @segment.default_percent,
          percent_flagged: @segment.percent_flagged
        }
      }
    else
      render json: { status: 'error', errors: @segment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    @segment.assign_attributes(segment_params)
    apply_default_percent_if_missing(@segment)
    if @segment.save
      render json: {
        status: 'success',
        segment: {
          id: @segment.id,
          name: @segment.name,
          start_day: @segment.start_day.to_f,
          end_day: @segment.end_day.to_f,
          color: @segment.color,
          default_percent: @segment.default_percent,
          percent_flagged: @segment.percent_flagged
        }
      }
    else
      render json: { status: 'error', errors: @segment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @segment.destroy
    render json: { status: 'success' }
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task
    @task = @project.tasks.find(params[:task_id])
  end

  def set_task_segment
    @segment = @task.task_segments.find(params[:id])
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

  def segment_params
    params.require(:task_segment).permit(:name, :start_day, :end_day, :color, :default_percent, :percent_flagged)
  end

  def apply_default_percent_if_missing(segment)
    return if segment.default_percent.present?
    return unless @task.start_date && @task.end_date
    duration = (@task.end_date - @task.start_date).to_i + 1
    return if duration <= 0
    days = segment.end_day.to_f - segment.start_day.to_f + 1.0
    segment.default_percent = ((days / duration.to_f) * 100).round(1)
    segment.percent_flagged = false if segment.percent_flagged.nil?
  end
end

