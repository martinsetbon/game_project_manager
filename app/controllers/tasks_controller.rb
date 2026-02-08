class TasksController < ApplicationController
  before_action :set_project
  before_action :set_project_feature
  before_action :set_task, only: [:update, :destroy]
  before_action :check_permissions

  def index
    @tasks = @project_feature.tasks.top_level.ordered
    render json: { 
      status: 'success', 
      tasks: @tasks.map { |t| 
        {
          id: t.id,
          name: t.name,
          duration: t.duration,
          start_day: t.start_day,
          end_day: t.end_day,
          order: t.order
        }
      }
    }
  end

  def create
    @task = @project_feature.tasks.build(task_params)
    
    if @task.save
      render json: { 
        status: 'success', 
        task: {
          id: @task.id,
          name: @task.name,
          duration: @task.duration,
          start_day: @task.start_day,
          end_day: @task.end_day,
          order: @task.order
        }
      }
    else
      render json: { status: 'error', errors: @task.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      render json: { 
        status: 'success', 
        task: {
          id: @task.id,
          name: @task.name,
          duration: @task.duration,
          start_day: @task.start_day,
          end_day: @task.end_day,
          order: @task.order
        }
      }
    else
      render json: { status: 'error', errors: @task.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @task.destroy
      render json: { status: 'success' }
    else
      render json: { status: 'error', errors: ['Failed to delete task'] }, status: :unprocessable_entity
    end
  end

  def update_template
    # This action handles bulk updates to the task template
    # It receives an array of tasks with their durations and names
    tasks_data = params[:tasks] || []
    
    # Validate total duration doesn't exceed feature duration
    feature_duration = (@project_feature.end_date - @project_feature.start_date).to_i + 1
    total_duration = tasks_data.sum { |t| t[:duration].to_i }
    
    if total_duration > feature_duration
      render json: { 
        status: 'error', 
        errors: ["Total task duration (#{total_duration} days) exceeds feature duration (#{feature_duration} days)"] 
      }, status: :unprocessable_entity
      return
    end

    begin
      ActiveRecord::Base.transaction do
        # Delete existing top-level tasks
        @project_feature.tasks.top_level.destroy_all
        
        # Create new tasks based on template
        current_day = 1
        order = 0
        
        tasks_data.each do |task_data|
          next if task_data[:name].blank? || task_data[:duration].to_i <= 0
          
          task_duration = task_data[:duration].to_i
          task_end_day = [current_day + task_duration - 1, feature_duration].min
          
          # Calculate actual dates
          task_start_date = @project_feature.start_date + (current_day - 1).days
          task_end_date = @project_feature.start_date + (task_end_day - 1).days
          
          # Ensure we don't exceed feature end date
          task_end_date = [task_end_date, @project_feature.end_date].min
          actual_duration = (task_end_date - task_start_date).to_i + 1
          
          task = @project_feature.tasks.create!(
            name: task_data[:name],
            status: 'not_started',
            department: task_data[:department],
            start_date: task_start_date,
            end_date: task_end_date,
            duration: actual_duration,
            order: order
          )
          
          # Create responsible assignment if provided
          if task_data[:responsible_user_id].present? && task_data[:responsible_user_id].to_i > 0
            task.task_assignments.create!(
              user_id: task_data[:responsible_user_id].to_i,
              role: 'responsible'
            )
          end
          
          # Create accountable assignment if provided
          if task_data[:accountable_user_id].present? && task_data[:accountable_user_id].to_i > 0
            task.task_assignments.create!(
              user_id: task_data[:accountable_user_id].to_i,
              role: 'accountable'
            )
          end
          
          current_day = task_end_day + 1
          order += 1
          
          # Stop if we've filled the entire feature duration
          break if current_day > feature_duration
        end
      end
      
      render json: { status: 'success', message: 'Task template updated successfully' }
    rescue => e
      render json: { status: 'error', errors: [e.message] }, status: :unprocessable_entity
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: 'error', errors: ['Project not found'] }, status: :not_found
  end

  def set_project_feature
    @project_feature = @project.project_features.find(params[:project_feature_id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: 'error', errors: ['Feature not found'] }, status: :not_found
  end

  def set_task
    @task = @project_feature.tasks.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: 'error', errors: ['Task not found'] }, status: :not_found
  end

  def check_permissions
    unless @project_feature.can_edit_details?(current_user)
      render json: { status: 'error', errors: ['You do not have permission to edit tasks'] }, status: :unauthorized
    end
  end

  def task_params
    params.require(:task).permit(:name, :duration, :start_date, :end_date, :start_time, :end_time, :order)
  end
end

