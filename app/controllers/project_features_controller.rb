class ProjectFeaturesController < ApplicationController
  before_action :set_project
  before_action :set_project_feature, except: [:index, :new, :create]
  before_action :check_permissions, except: [:index, :new, :create]

  def new
    # Only project manager can create features
    unless @project.user == current_user
      redirect_to project_path(@project), alert: 'Only the project manager can create features.'
      return
    end
    
    @project_feature = @project.project_features.build
    load_contributors
    @feature_templates = current_user.feature_templates.order(created_at: :desc)
  end

  def create
    # Only project manager can create features
    unless @project.user == current_user
      redirect_to project_path(@project), alert: 'Only the project manager can create features.'
      return
    end
    
    template_id = project_feature_params[:template_id]
    template = current_user.feature_templates.find_by(id: template_id) if template_id.present?
    
    feature_params = project_feature_params.except(:responsible_user_id, :accountable_user_id, :template_id)
    
    @project_feature = @project.project_features.build(feature_params)
    load_contributors
    @feature_templates = current_user.feature_templates.order(created_at: :desc)

    if @project_feature.save
      # Apply template if one was selected
      if template
        apply_template_to_feature(template, @project_feature)
      end

      redirect_to project_path(@project), notice: 'Feature created successfully.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def show
    load_contributors
  end

  def edit
    load_contributors
    @project_feature.responsible_user_id = @project_feature.responsible_contributors.first&.id
    @project_feature.accountable_user_id = @project_feature.accountable_contributors.first&.id
  end

  def update
    load_contributors

    # Handle field updates from inline editing
    if params[:field].present?
      unless @project_feature.can_edit_details?(current_user)
        render json: { status: 'error', errors: ['You do not have permission to edit this feature.'] }, status: :unauthorized
        return
      end

      field_name = params[:field]
      
      # Handle date fields even if value is empty string (to allow clearing dates)
      if params[:value].present? || ['start_date', 'end_date'].include?(field_name)
        case field_name
        when 'name'
          @project_feature.name = params[:value]
        when 'duration'
          @project_feature.duration = params[:value].to_i
          # Recalculate end date if start_date exists
          if @project_feature.start_date.present?
            @project_feature.end_date = @project_feature.start_date + @project_feature.duration.days
          end
        when 'start_date'
          Rails.logger.info "Updating start_date: params[:value] = #{params[:value].inspect}"
          Rails.logger.info "Current start_date before update: #{@project_feature.start_date}"
          
          if params[:value].present? && params[:value].to_s.strip != ''
            parsed_date = Date.parse(params[:value].to_s.strip) rescue nil
            if parsed_date
              Rails.logger.info "Parsed start_date: #{parsed_date}"
              # Use update_column to bypass callbacks and validations for date updates
              # This directly updates the database without triggering callbacks
              result = @project_feature.update_column(:start_date, parsed_date)
              Rails.logger.info "update_column result: #{result}"
              
              # Reload to get fresh data from database
              @project_feature.reload
              Rails.logger.info "After reload, start_date in DB: #{@project_feature.start_date}"
              
              if @project_feature.start_date != parsed_date
                Rails.logger.error "ERROR: Date was not saved! Expected #{parsed_date}, got #{@project_feature.start_date}"
              end
            else
              Rails.logger.error "Failed to parse start_date: #{params[:value]}"
              render json: { status: 'error', errors: ['Invalid date format'] }, status: :unprocessable_entity
              return
            end
          else
            Rails.logger.info "Clearing start_date (value was empty)"
            @project_feature.update_column(:start_date, nil)
            @project_feature.reload
            Rails.logger.info "After reload, start_date cleared: #{@project_feature.start_date}"
          end
        when 'end_date'
          Rails.logger.info "Updating end_date: params[:value] = #{params[:value].inspect}"
          Rails.logger.info "Current end_date before update: #{@project_feature.end_date}"
          
          if params[:value].present? && params[:value].to_s.strip != ''
            parsed_date = Date.parse(params[:value].to_s.strip) rescue nil
            if parsed_date
              Rails.logger.info "Parsed end_date: #{parsed_date}"
              # Use update_column to bypass callbacks and validations for date updates
              # This directly updates the database without triggering callbacks
              result = @project_feature.update_column(:end_date, parsed_date)
              Rails.logger.info "update_column result: #{result}"
              
              # Reload to get fresh data from database
              @project_feature.reload
              Rails.logger.info "After reload, end_date in DB: #{@project_feature.end_date}"
              
              if @project_feature.end_date != parsed_date
                Rails.logger.error "ERROR: Date was not saved! Expected #{parsed_date}, got #{@project_feature.end_date}"
              end
            else
              Rails.logger.error "Failed to parse end_date: #{params[:value]}"
              render json: { status: 'error', errors: ['Invalid date format'] }, status: :unprocessable_entity
              return
            end
          else
            Rails.logger.info "Clearing end_date (value was empty)"
            @project_feature.update_column(:end_date, nil)
            @project_feature.reload
            Rails.logger.info "After reload, end_date cleared: #{@project_feature.end_date}"
          end
        when 'status'
          @project_feature.status = params[:value]
        when 'responsible_user_id'
          # Update responsible contributors
          @project_feature.feature_assignments.where(role: 'responsible').delete_all
          if params[:value].present? && params[:value] != '0'
            create_assignment(@project_feature, params[:value], 'responsible')
          end
          @project_feature.reload
        when 'accountable_user_id'
          # Update accountable contributors
          @project_feature.feature_assignments.where(role: 'accountable').delete_all
          if params[:value].present? && params[:value] != '0'
            create_assignment(@project_feature, params[:value], 'accountable')
          end
          @project_feature.reload
        end
        
        # For date fields, we've already saved using update_column, so skip the save
        if ['start_date', 'end_date'].include?(field_name)
          saved = true
          # Already reloaded above
        else
          # Save the feature - ensure it actually commits
          begin
            saved = @project_feature.save
            
            if saved
              # Reload to ensure we have the saved data from database
              @project_feature.reload
              
              Rails.logger.info "Feature #{@project_feature.id} saved successfully: start_date=#{@project_feature.start_date}, end_date=#{@project_feature.end_date}"
            else
              Rails.logger.error "Feature #{@project_feature.id} failed to save: #{@project_feature.errors.full_messages.join(', ')}"
            end
          rescue => e
            Rails.logger.error "Error saving feature #{@project_feature.id}: #{e.message}"
            Rails.logger.error e.backtrace.join("\n")
            saved = false
          end
        end
        
        if saved
          # For date fields, we've already updated via update_column and reloaded
          # Don't run overlap prevention on inline date edits - let the user set dates as they want
          # Only prevent overlaps when changing responsible contributors
          if field_name == 'responsible_user_id' && @project_feature.responsible_contributors.any?
            @project_feature.prevent_overlaps_for_responsible_contributors
            @project_feature.reload
          end
          
          # Format response based on field
          response_value = case field_name
          when 'start_date', 'end_date'
            # For date fields, query the database directly to get the absolute latest value
            # This bypasses any Rails caching or object state issues
            db_value = ProjectFeature.where(id: @project_feature.id).pluck(field_name.to_sym).first
            Rails.logger.info "Feature #{@project_feature.id} #{field_name} direct DB value for response: #{db_value}"
            
            # Also reload the object to keep it in sync
            @project_feature.reload
            object_value = @project_feature.send(field_name)
            Rails.logger.info "Feature #{@project_feature.id} #{field_name} object value after reload: #{object_value}"
            
            # Always use the database value as the source of truth
            date_value = db_value || object_value
            
            formatted_date = date_value ? date_value.strftime('%Y-%m-%d') : 'Not set'
            Rails.logger.info "Feature #{@project_feature.id} #{field_name} final formatted value: #{formatted_date}"
            formatted_date
          when 'duration'
            "#{@project_feature.duration} #{@project_feature.duration == 1 ? 'day' : 'days'}"
          when 'status'
            case @project_feature.status
            when 'work_in_progress'
              'On Going'
            when 'stand_by'
              'Stand By'
            else
              @project_feature.status.humanize
            end
          when 'responsible_user_id', 'accountable_user_id'
            # Return HTML for contributors section
            contributor = field_name == 'responsible_user_id' ? 
              @project_feature.responsible_contributors.first : 
              @project_feature.accountable_contributors.first
            if contributor
              "#{contributor.name}#{contributor.job.present? ? " - #{contributor.job}" : ''}"
            else
              'Not assigned'
            end
          else
            @project_feature.send(field_name) || 'Not set'
          end
          
          render json: { status: 'success', value: response_value, formatted_value: response_value }
        else
          render json: { status: 'error', errors: @project_feature.errors.full_messages }, status: :unprocessable_entity
        end
        return
      end
    end

    # Regular update from edit form
    # Filter params based on user permissions
    if @project_feature.can_edit_details?(current_user)
      # Project manager can edit everything
      update_params = project_feature_params.except(:responsible_user_id, :accountable_user_id)
    else
      # Contributors cannot edit anything through this form
      update_params = {}
    end

    if @project_feature.update(update_params)
      # Only update assignments if user can edit details (project manager)
      if @project_feature.can_edit_details?(current_user)
        # Update assignments first - use delete_all instead of destroy_all to avoid callbacks
        @project_feature.feature_assignments.delete_all
        
        create_assignment(@project_feature, project_feature_params[:responsible_user_id], 'responsible') if project_feature_params[:responsible_user_id].present?
        create_assignment(@project_feature, project_feature_params[:accountable_user_id], 'accountable') if project_feature_params[:accountable_user_id].present?
      end

      redirect_to project_path(@project), notice: 'Feature updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    # Store responsible contributors before deletion
    responsible_contributors = @project_feature.responsible_contributors.to_a
    
    @project_feature.destroy
    
    # Readjust remaining features for the same responsible contributors
    if responsible_contributors.any?
      responsible_user_ids = responsible_contributors.map(&:id)
      remaining_features = @project.project_features
                                  .joins(:responsible_assignments)
                                  .where(feature_assignments: { user_id: responsible_user_ids, role: 'responsible' })
                                  .order(:start_date)
      
      if remaining_features.any?
        # Use the first remaining feature to trigger the overlap prevention
        remaining_features.first.prevent_overlaps_for_responsible_contributors
      end
    end
    
    redirect_to project_path(@project), notice: 'Feature deleted.'
  end

  def update_dates
    Rails.logger.info "PARAMS: #{params.inspect}"
    if @project_feature.update(feature_date_params)
      # Prevent overlaps for all features with the same responsible contributor
      if @project_feature.responsible_contributors.any?
        @project_feature.prevent_overlaps_for_responsible_contributors
      end
      
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

  def change_status
    new_status = params[:status]
    
    Rails.logger.info "Change status called: #{new_status}, current status: #{@project_feature.status}, user: #{current_user.id}"
    
    case new_status
    when 'work_in_progress'
      if @project_feature.status == 'not_started'
        @project_feature.update_column(:status, 'work_in_progress')
        redirect_to project_path(@project), notice: 'Work started successfully.'
      elsif @project_feature.status == 'stand_by'
        if @project_feature.resume_from_stand_by!
          redirect_to project_path(@project), notice: 'Work resumed successfully.'
        else
          redirect_to project_path(@project), alert: 'Error resuming work.'
        end
      else
        redirect_to project_path(@project), alert: 'Cannot start work from current status.'
      end
    when 'stand_by'
      @project_feature.update_column(:status, 'stand_by')
      @project_feature.update_column(:stand_by_started_at, Time.current)
      redirect_to project_path(@project), notice: 'Feature set to stand by.'
    when 'request_approval'
      @project_feature.update_column(:approval_requested, true)
      @project_feature.update_column(:approval_requested_at, Time.current)
      redirect_to project_path(@project), notice: 'Approval requested successfully.'
    when 'job_done'
      @project_feature.update_column(:status, 'job_done')
      @project_feature.update_column(:approval_requested, false)
      @project_feature.update_column(:approval_requested_at, nil)
      redirect_to project_path(@project), notice: 'Feature approved and completed.'
    else
      redirect_to project_path(@project), alert: 'Invalid status change.'
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

  def check_permissions
    case action_name
    when 'edit', 'update'
      unless @project_feature.can_edit?(current_user)
        redirect_to project_path(@project), alert: 'You do not have permission to edit this feature.'
      end
    when 'destroy'
      unless @project_feature.can_delete?(current_user)
        redirect_to project_path(@project), alert: 'You do not have permission to delete this feature.'
      end
    when 'change_status'
      unless @project_feature.can_change_status?(current_user)
        redirect_to project_path(@project), alert: 'You do not have permission to change the status of this feature.'
      end
    when 'update_dates'
      unless @project_feature.can_edit?(current_user)
        redirect_to project_path(@project), alert: 'You do not have permission to update this feature.'
      end
    end
  end

  def project_feature_params
    params.require(:project_feature).permit(:name, :duration, :start_date,
                                          :responsible_user_id, :accountable_user_id, :template_id)
  end

  def feature_date_params
    params.require(:project_feature).permit(:start_date, :duration)
  end

  def load_contributors
    @project_contributors = @project.project_contributors.includes(:user)
    @contributors = @project_contributors.map(&:user).uniq
    # Load all users for assignment (including project owner)
    @all_users = User.all
  end

  def create_assignment(feature, user_id, role)
    feature.feature_assignments.create(user_id: user_id, role: role)
  end

  def apply_template_to_feature(template, feature)
    return unless feature.start_date.present?
    
    tasks_data = template.tasks_data || []
    return if tasks_data.empty?
    
    # Calculate feature duration from tasks if end_date is not set
    total_duration = tasks_data.sum { |t| t['duration'].to_i || t[:duration].to_i }
    
    # Set end_date based on template tasks if not already set
    if feature.end_date.nil? && feature.start_date.present?
      feature.update_column(:end_date, feature.start_date + (total_duration - 1).days)
      feature.reload
    end
    
    feature_duration = feature.end_date ? (feature.end_date - feature.start_date).to_i + 1 : total_duration
    
    # Adjust if template duration exceeds feature duration
    if total_duration > feature_duration
      # Extend feature end_date to accommodate template
      feature.update_column(:end_date, feature.start_date + (total_duration - 1).days)
      feature.reload
      feature_duration = total_duration
    end
    
    ActiveRecord::Base.transaction do
      # Create tasks based on template
      current_day = 1
      order = 0
      
      tasks_data.each do |task_data|
        # Handle both string and symbol keys
        task_name = task_data['name'] || task_data[:name]
        task_duration = (task_data['duration'] || task_data[:duration]).to_i
        
        next if task_name.blank? || task_duration <= 0
        
        task_end_day = [current_day + task_duration - 1, feature_duration].min
        
        # Calculate actual dates
        task_start_date = feature.start_date + (current_day - 1).days
        task_end_date = feature.start_date + (task_end_day - 1).days
        
        # Ensure we don't exceed feature end date
        task_end_date = [task_end_date, feature.end_date].min if feature.end_date
        actual_duration = (task_end_date - task_start_date).to_i + 1
        
        # Set backlog fields based on task priority
        task_priority = task_data['priority'] || task_data[:priority] || 'high'
        backlog_type = nil
        project_id = nil
        if task_priority == 'low'
          backlog_type = 'project'
          project_id = feature.project_id
        end
        
        task = feature.tasks.create!(
          name: task_name,
          status: 'not_started',
          start_date: task_start_date,
          end_date: task_end_date,
          duration: actual_duration,
          order: order,
          backlog_type: backlog_type,
          project_id: project_id
        )
        
        # Create responsible assignment if provided
        responsible_id = task_data['responsible_user_id'] || task_data[:responsible_user_id]
        if responsible_id.present? && responsible_id.to_i > 0
          task.task_assignments.create!(
            user_id: responsible_id.to_i,
            role: 'responsible'
          )
        end
        
        # Create accountable assignment if provided
        accountable_id = task_data['accountable_user_id'] || task_data[:accountable_user_id]
        if accountable_id.present? && accountable_id.to_i > 0
          task.task_assignments.create!(
            user_id: accountable_id.to_i,
            role: 'accountable'
          )
        end
        
        current_day = task_end_day + 1
        order += 1
        
        # Stop if we've filled the entire feature duration
        break if current_day > feature_duration
      end
    end
  rescue => e
    Rails.logger.error "Error applying template to feature: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    # Don't fail feature creation if template application fails
  end
end
