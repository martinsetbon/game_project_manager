class ApplicationController < ActionController::Base
  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?

  # Redirect to dashboard after login
  def after_sign_in_path_for(resource)
    dashboard_path
  end

  private

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name, :job])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :job, :country, :self_introduction, :hobbies, :skills, :speaking_languages, :avatar, :resume])
  end
end
