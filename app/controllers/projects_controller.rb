class ProjectsController < ApplicationController
  before_action :set_project, only: [:show, :edit, :update, :destroy]
  before_action :authenticate_user!

  def index
    @projects = current_user.projects
  end

  def show
    @project_features = @project.project_features.includes(:responsible_assignments, responsible_contributors: :user)
    @contributors = @project.contributors
  end

  def new
    @project = current_user.projects.build
    @users = User.all # Load all users to assign to the project
  end

  def create
    @project = current_user.projects.build(project_params)
    @project.start_date ||= Date.today

    if @project.save
      redirect_to @project, notice: "Project was successfully created."
    else
      @users = User.all # Reload users in case of validation failure
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @users = User.all # Load users for the form
  end

  def update
    if @project.update(project_params)
      redirect_to @project, notice: "Project was successfully updated."
    else
      @users = User.all # Reload users in case of validation failure
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project.destroy
    redirect_to projects_path, notice: "Project was successfully deleted."
  end

  def team
    @project = Project.find(params[:id])
  end

  private

  def set_project
    @project = Project.find(params[:id])
  end

  def project_params
    params.require(:project).permit(:name, :description, :start_date, :end_date, :budget, :currency, contributor_ids: [])
  end
end
