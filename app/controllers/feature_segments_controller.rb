class FeatureSegmentsController < ApplicationController
  before_action :set_project
  before_action :set_project_feature
  before_action :set_feature_segment, only: [:update, :destroy]
  before_action :check_permissions

  def create
    @segment = @project_feature.feature_segments.build(segment_params)
    
    if @segment.save
      render json: { 
        status: 'success', 
        segment: {
          id: @segment.id,
          name: @segment.name,
          start_day: @segment.start_day,
          end_day: @segment.end_day
        }
      }
    else
      render json: { status: 'error', errors: @segment.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @segment.update(segment_params)
      render json: { 
        status: 'success', 
        segment: {
          id: @segment.id,
          name: @segment.name,
          start_day: @segment.start_day,
          end_day: @segment.end_day
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

  def set_project_feature
    @project_feature = @project.project_features.find(params[:project_feature_id])
  end

  def set_feature_segment
    @segment = @project_feature.feature_segments.find(params[:id])
  end

  def check_permissions
    unless @project_feature.can_edit_details?(current_user)
      render json: { status: 'error', errors: ['You do not have permission to edit this feature.'] }, status: :unauthorized
    end
  end

  def segment_params
    params.require(:feature_segment).permit(:name, :start_day, :end_day)
  end
end

