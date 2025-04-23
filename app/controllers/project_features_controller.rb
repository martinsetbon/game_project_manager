class ProjectFeaturesController < ApplicationController
  before_action :set_project
  before_action :set_project_feature, only: [:show, :edit, :update, :destroy]

  def new
    @project_feature = @project.project_features.build
    @users = @project.contributors
  end

  def create
    @project_feature = @project.project_features.build(project_feature_params)
    if @project_feature.save
      redirect_to project_path(@project), notice: 'Feature created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @users = @project.contributors
  end

  def update
    if @project_feature.update(project_feature_params)
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
  end

  def set_project_feature
    @project_feature = @project.project_features.find(params[:id])
  end

  def project_feature_params
    params.require(:project_feature).permit(:name, :duration, contributor_ids: [])
  end
end
