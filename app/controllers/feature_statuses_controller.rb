class FeatureStatusesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_project_feature

  def update
    if @project_feature.can_change_status?(current_user)
      if @project_feature.update(status: params[:status])
        redirect_to project_path(@project_feature.project), notice: "Status updated successfully."
      else
        redirect_to project_path(@project_feature.project), alert: "Failed to update status."
      end
    else
      redirect_to project_path(@project_feature.project), alert: "You don't have permission to change this status."
    end
  end

  private

  def set_project_feature
    @project_feature = ProjectFeature.find(params[:id])
  end
end
