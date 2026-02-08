class ProfilesController < ApplicationController
  before_action :authenticate_user!

  def show
    @user = current_user
  end

  def update
    @user = current_user
    
    # Handle file uploads separately
    if params[:field] == 'avatar'
      if params[:user] && params[:user][:avatar]
        @user.avatar.attach(params[:user][:avatar])
        redirect_to profile_path, notice: 'Avatar updated successfully'
      else
        redirect_to profile_path, alert: 'Please select a file to upload'
      end
      return
    elsif params[:field] == 'resume'
      if params[:user] && params[:user][:resume]
        @user.resume.attach(params[:user][:resume])
        redirect_to profile_path, notice: 'Resume updated successfully'
      else
        redirect_to profile_path, alert: 'Please select a file to upload'
      end
      return
    end
    
    # For other updates, use user_params
    begin
      update_params = user_params
    rescue ActionController::ParameterMissing
      redirect_to profile_path, alert: 'Invalid parameters'
      return
    end
    
    # Handle password update - skip current password for logged-in users
    if update_params[:password].present?
      if update_params[:password].length >= 6
        @user.password = update_params[:password]
        @user.password_confirmation = update_params[:password_confirmation]
        if @user.save
          render json: { status: 'success', message: 'Profile updated successfully' }
        else
          render json: { status: 'error', errors: @user.errors.full_messages }, status: :unprocessable_entity
        end
      else
        render json: { status: 'error', errors: ['Password must be at least 6 characters'] }, status: :unprocessable_entity
      end
    else
      update_params.delete(:password)
      update_params.delete(:password_confirmation)
      if @user.update(update_params)
        render json: { status: 'success', message: 'Profile updated successfully' }
      else
        render json: { status: 'error', errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end

  def update_field
    @user = current_user
    field_name = params[:field]
    value = params[:value]

    # Handle password update
    if field_name == 'password'
      if value.present? && value.length >= 6
        @user.password = value
        @user.password_confirmation = value
        # Skip current password validation for simplicity
        @user.skip_password_validation = true if @user.respond_to?(:skip_password_validation=)
      else
        render json: { status: 'error', errors: ['Password must be at least 6 characters'] }, status: :unprocessable_entity
        return
      end
    # Handle array fields (skills, speaking_languages)
    elsif ['skills', 'speaking_languages'].include?(field_name)
      # Value is already an array from JSON parsing
      @user.send("#{field_name}=", value)
    else
      @user.send("#{field_name}=", value)
    end

    # Skip validation for non-password fields to allow partial updates
    if field_name == 'password'
      if @user.save
        render json: { status: 'success', value: '••••••••' }
      else
        render json: { status: 'error', errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    else
      if @user.save(validate: false)
        render json: { status: 'success', value: @user.send(field_name) }
      else
        render json: { status: 'error', errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end

  private

  def user_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :current_password, :country, 
                                  :self_introduction, :job, :hobbies, 
                                  skills: [], speaking_languages: [], 
                                  avatar: [], resume: [])
  end
end

