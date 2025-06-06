class ProjectFeaturesController < ApplicationController
  before_action :set_project
  before_action :set_project_feature, except: [:index, :new, :create]

  def new
    @project_feature = @project.project_features.build
    load_contributors
  end

  def create
    @project_feature = @project.project_features.build(project_feature_params.except(:responsible_user_id, :accountable_user_id))
    load_contributors

    if @project_feature.save
      # Handle assignments
      create_assignment(@project_feature, project_feature_params[:responsible_user_id], 'responsible') if project_feature_params[:responsible_user_id].present?
      create_assignment(@project_feature, project_feature_params[:accountable_user_id], 'accountable') if project_feature_params[:accountable_user_id].present?

      redirect_to project_path(@project), notice: 'Feature created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    load_contributors
    @project_feature.responsible_user_id = @project_feature.responsible_contributors.first&.id
    @project_feature.accountable_user_id = @project_feature.accountable_contributors.first&.id
  end

  def update
    load_contributors

    if @project_feature.update(project_feature_params.except(:responsible_user_id, :accountable_user_id))
      # Update assignments
      @project_feature.feature_assignments.destroy_all
      create_assignment(@project_feature, project_feature_params[:responsible_user_id], 'responsible') if project_feature_params[:responsible_user_id].present?
      create_assignment(@project_feature, project_feature_params[:accountable_user_id], 'accountable') if project_feature_params[:accountable_user_id].present?

      redirect_to project_path(@project), notice: 'Feature updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project_feature.destroy
    redirect_to project_path(@project), notice: 'Feature deleted.'
  end

  def update_dates
    Rails.logger.info "PARAMS: #{params.inspect}"
    if @project_feature.update(feature_date_params)
      render json: {
        status: 'success',
        feature: {
          id: @project_feature.id,
          start_date: @project_feature.start_date,
          end_date: @project_feature.end_date,
          duration: @project_feature.duration
        }
      }
    else
      Rails.logger.info "ERRORS: #{@project_feature.errors.full_messages}"
      render json: { status: 'error', errors: @project_feature.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  rescue ActiveRecord::RecordNotFound
    redirect_to projects_path, alert: 'Project not found'
  end

  def set_project_feature
    @project_feature = @project.project_features.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to project_path(@project), alert: 'Feature not found'
  end

  def project_feature_params
    params.require(:project_feature).permit(:name, :duration, :status, :department, :start_date,
                                          :responsible_user_id, :accountable_user_id)
  end

  def feature_date_params
    params.require(:project_feature).permit(:start_date, :duration)
  end

  def load_contributors
    @project_contributors = @project.project_contributors.includes(:user)
    @contributors = @project_contributors.map(&:user).uniq
  end

  def create_assignment(feature, user_id, role)
    feature.feature_assignments.create(user_id: user_id, role: role)
  end
end
