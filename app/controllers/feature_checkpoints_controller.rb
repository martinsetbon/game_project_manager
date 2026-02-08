class FeatureCheckpointsController < ApplicationController
  before_action :set_project
  before_action :set_project_feature
  before_action :set_feature_checkpoint, only: [:destroy]
  before_action :check_permissions

  def create
    begin
      Rails.logger.info "Checkpoint create params: #{params.inspect}"
      Rails.logger.info "Feature checkpoint params: #{params[:feature_checkpoint].inspect}"
      
      permitted_params = checkpoint_params
      Rails.logger.info "Permitted params: #{permitted_params.inspect}"
      
      if permitted_params[:day].blank?
        render json: { status: 'error', errors: ['Day parameter is required'] }, status: :unprocessable_entity
        return
      end
      
      @checkpoint = @project_feature.feature_checkpoints.build(permitted_params)
      Rails.logger.info "Checkpoint built: #{@checkpoint.inspect}"
      Rails.logger.info "Checkpoint day: #{@checkpoint.day.inspect}"
      Rails.logger.info "Checkpoint project_feature_id: #{@checkpoint.project_feature_id.inspect}"
      
      # Check validations manually
      @checkpoint.valid?
      Rails.logger.info "Checkpoint valid?: #{@checkpoint.valid?}"
      Rails.logger.info "Checkpoint errors object: #{@checkpoint.errors.inspect}"
      Rails.logger.info "Checkpoint errors full_messages: #{@checkpoint.errors.full_messages.inspect}"
      Rails.logger.info "Checkpoint errors details: #{@checkpoint.errors.details.inspect}"
      
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
        Rails.logger.error "Checkpoint validation failed: #{errors.inspect}"
        Rails.logger.error "Checkpoint params: #{permitted_params.inspect}"
        Rails.logger.error "Checkpoint attributes: #{@checkpoint.attributes.inspect}"
        render json: { status: 'error', errors: errors }, status: :unprocessable_entity
      end
    rescue ActionController::ParameterMissing => e
      Rails.logger.error "Parameter missing: #{e.message}"
      render json: { status: 'error', errors: ["Missing parameter: #{e.message}"] }, status: :unprocessable_entity
    rescue => e
      Rails.logger.error "Checkpoint creation error: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: { status: 'error', errors: [e.message] }, status: :unprocessable_entity
    end
  end

  def destroy
    @checkpoint.destroy
    render json: { status: 'success' }
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_project_feature
    @project_feature = @project.project_features.find(params[:project_feature_id])
  end

  def set_feature_checkpoint
    @checkpoint = @project_feature.feature_checkpoints.find(params[:id])
  end

  def check_permissions
    unless @project_feature.can_edit_details?(current_user)
      render json: { status: 'error', errors: ['You do not have permission to edit this feature.'] }, status: :unauthorized
    end
  end

  def checkpoint_params
    cp_params = params.require(:feature_checkpoint).permit(:day)
    cp_params[:day] = cp_params[:day].to_i if cp_params[:day].present?
    cp_params
  end
end

