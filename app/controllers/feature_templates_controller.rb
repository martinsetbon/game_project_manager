class FeatureTemplatesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_feature_template, only: [:destroy, :apply_to_feature]

  def index
    @templates = current_user.feature_templates.order(created_at: :desc)
    render json: { 
      status: 'success', 
      templates: @templates.map { |t| 
        {
          id: t.id,
          name: t.name,
          tasks_count: t.tasks_data&.length || 0,
          created_at: t.created_at
        }
      }
    }
  end

  def create
    Rails.logger.info "Creating template with params: #{feature_template_params.inspect}"
    @template = current_user.feature_templates.build(feature_template_params)
    
    if @template.save
      Rails.logger.info "Template saved successfully: #{@template.id}"
      render json: { 
        status: 'success', 
        template: {
          id: @template.id,
          name: @template.name,
          tasks_count: @template.tasks_data&.length || 0
        }
      }
    else
      Rails.logger.error "Template save failed: #{@template.errors.full_messages}"
      render json: { status: 'error', errors: @template.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @template.destroy
      render json: { status: 'success' }
    else
      render json: { status: 'error', errors: ['Failed to delete template'] }, status: :unprocessable_entity
    end
  end

  def apply_to_feature
    project_feature = ProjectFeature.find(params[:project_feature_id])
    
    unless project_feature.can_edit_details?(current_user)
      render json: { status: 'error', errors: ['You do not have permission to edit this feature'] }, status: :unauthorized
      return
    end
    
    unless project_feature.start_date && project_feature.end_date
      render json: { status: 'error', errors: ['Feature must have start and end dates'] }, status: :unprocessable_entity
      return
    end
    
    tasks_data = @template.tasks_data || []
    feature_duration = (project_feature.end_date - project_feature.start_date).to_i + 1
    total_duration = tasks_data.sum { |t| t['duration'].to_i }
    
    if total_duration > feature_duration
      render json: { 
        status: 'error', 
        errors: ["Template total duration (#{total_duration} days) exceeds feature duration (#{feature_duration} days)"] 
      }, status: :unprocessable_entity
      return
    end

    begin
      ActiveRecord::Base.transaction do
        # Delete existing top-level tasks
        project_feature.tasks.top_level.destroy_all
        
        # Create new tasks based on template
        current_day = 1
        order = 0
        
        tasks_data.each do |task_data|
          next if task_data['name'].blank? || task_data['duration'].to_i <= 0
          
          task_duration = task_data['duration'].to_i
          task_end_day = [current_day + task_duration - 1, feature_duration].min
          
          # Calculate actual dates
          task_start_date = project_feature.start_date + (current_day - 1).days
          task_end_date = project_feature.start_date + (task_end_day - 1).days
          
          # Ensure we don't exceed feature end date
          task_end_date = [task_end_date, project_feature.end_date].min
          actual_duration = (task_end_date - task_start_date).to_i + 1
          
          # Set backlog fields based on task priority
          task_priority = task_data['priority'] || task_data[:priority] || 'high'
          backlog_type = nil
          project_id = nil
          if task_priority == 'low'
            backlog_type = 'project'
            project_id = project_feature.project_id
          end
          
          task = project_feature.tasks.create!(
            name: task_data['name'],
            status: 'not_started',
            start_date: task_start_date,
            end_date: task_end_date,
            duration: actual_duration,
            order: order,
            backlog_type: backlog_type,
            project_id: project_id
          )
          
          # Create responsible assignment if provided
          if task_data['responsible_user_id'].present? && task_data['responsible_user_id'].to_i > 0
            task.task_assignments.create!(
              user_id: task_data['responsible_user_id'].to_i,
              role: 'responsible'
            )
          end
          
          # Create accountable assignment if provided
          if task_data['accountable_user_id'].present? && task_data['accountable_user_id'].to_i > 0
            task.task_assignments.create!(
              user_id: task_data['accountable_user_id'].to_i,
              role: 'accountable'
            )
          end
          
          current_day = task_end_day + 1
          order += 1
          
          # Stop if we've filled the entire feature duration
          break if current_day > feature_duration
        end
      end
      
      render json: { status: 'success', message: 'Template applied successfully' }
    rescue => e
      render json: { status: 'error', errors: [e.message] }, status: :unprocessable_entity
    end
  end

  private

  def set_feature_template
    @template = current_user.feature_templates.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { status: 'error', errors: ['Template not found'] }, status: :not_found
  end

  def feature_template_params
    Rails.logger.info "Raw params: #{params.inspect}"
    
    # Handle JSON body - tasks_data comes as an array of hashes
    if params[:feature_template] && params[:feature_template][:tasks_data].is_a?(Array)
      # Allow the array structure
      permitted = params.require(:feature_template).permit(:name, tasks_data: [:name, :duration, :priority, :responsible_user_id, :accountable_user_id])
    else
      permitted = params.require(:feature_template).permit(:name, tasks_data: [])
    end
    
    Rails.logger.info "Permitted params: #{permitted.inspect}"
    
    # Ensure tasks_data is an array of hashes
    if permitted[:tasks_data].present?
      if permitted[:tasks_data].is_a?(Array)
        # Convert to array of hashes with symbol keys
        permitted[:tasks_data] = permitted[:tasks_data].map do |task|
          if task.is_a?(ActionController::Parameters)
            task.permit(:name, :duration, :priority, :responsible_user_id, :accountable_user_id).to_h.symbolize_keys
          elsif task.is_a?(Hash)
            task.symbolize_keys.slice(:name, :duration, :priority, :responsible_user_id, :accountable_user_id)
          else
            task
          end
        end.compact
      end
    else
      permitted[:tasks_data] = []
    end
    
    Rails.logger.info "Final params: #{permitted.inspect}"
    permitted
  end
end

