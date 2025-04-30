class ProjectFeaturesController < ApplicationController
  before_action :set_project
  before_action :set_project_feature, only: [:show, :edit, :update, :destroy]

  def new
    @project_feature = @project.project_features.build
    load_contributors
  end

  def create
    @project_feature = @project.project_features.build(project_feature_params)
    load_contributors

    if @project_feature.save
      # Handle assignments after successful save
      create_assignment(@project_feature, params[:project_feature][:responsible_contributor_id], 'responsible') if params[:project_feature][:responsible_contributor_id].present?
      create_assignment(@project_feature, params[:project_feature][:accountable_contributor_id], 'accountable') if params[:project_feature][:accountable_contributor_id].present?

      redirect_to project_path(@project), notice: 'Feature created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    load_contributors
  end

  def update
    load_contributors

    if @project_feature.update(project_feature_params)
      @project_feature.feature_assignments.destroy_all
      create_assignment(@project_feature, params[:project_feature][:responsible_contributor_id], 'responsible') if params[:project_feature][:responsible_contributor_id].present?
      create_assignment(@project_feature, params[:project_feature][:accountable_contributor_id], 'accountable') if params[:project_feature][:accountable_contributor_id].present?

      redirect_to project_path(@project), notice: 'Feature updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project_feature.destroy
    redirect_to project_path(@project), notice: 'Feature deleted.'
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
    params.require(:project_feature).permit(:name, :duration, :status)
  end

  def load_contributors
    @project_contributors = @project.project_contributors.includes(:user)
    @contributors = @project_contributors.map(&:user).uniq
  end

  def create_assignment(feature, user_id, role)
    feature.feature_assignments.create(user_id: user_id, role: role)
  end
end
