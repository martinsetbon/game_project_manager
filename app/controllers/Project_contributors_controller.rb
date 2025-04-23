class ProjectContributorsController < ApplicationController
  before_action :set_project

  def create
    user = User.find(params[:user_id])
    @project.contributors << user
    redirect_to team_project_path(@project), notice: "Contributor added successfully."
  end

  def destroy
    user = User.find(params[:user_id])
    @project.contributors.delete(user) # Remove the contributor from the project
    redirect_to team_project_path(@project), notice: "Contributor removed successfully."
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end
end
