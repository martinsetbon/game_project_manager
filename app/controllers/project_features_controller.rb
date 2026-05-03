class ProjectFeaturesController < ApplicationController
  before_action :set_project
  before_action :set_project_feature, except: [:index, :new, :create, :new_from_tasks, :create_from_tasks, :new_with_tasks, :create_with_tasks, :create_from_timeline]
  before_action :check_permissions, except: [:index, :new, :create, :new_from_tasks, :create_from_tasks, :new_with_tasks, :create_with_tasks, :create_from_timeline]
  before_action :ensure_project_manager_for_bulk, only: [:new, :create, :new_from_tasks, :create_from_tasks, :new_with_tasks, :create_with_tasks, :create_from_timeline]

  def index
    @project_features = @project.project_features.includes(:tasks).order(:name)
  end

  def new
    @project_feature = @project.project_features.build
    @template_id_for_form = params[:template_id].presence
    @task_templates_json = current_user.feature_templates.order(created_at: :desc).map { |t| { id: t.id, name: t.name } }
    load_contributors
  end

  def create
    redirect_to new_project_project_feature_path(@project),
                alert: 'Use Create feature or Create with template on the new feature form.'
  end

  def show
    prepare_feature_show
  end

  def edit
    redirect_to project_project_feature_path(@project, @project_feature)
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
      if @project_feature.can_edit_details?(current_user)
        pf_raw = params[:project_feature]
        if pf_raw.respond_to?(:key?) && (pf_raw.key?(:responsible_user_id) || pf_raw.key?(:accountable_user_id) ||
            pf_raw.key?('responsible_user_id') || pf_raw.key?('accountable_user_id'))
          @project_feature.feature_assignments.delete_all
          rid = pf_raw[:responsible_user_id] || pf_raw['responsible_user_id']
          aid = pf_raw[:accountable_user_id] || pf_raw['accountable_user_id']
          create_assignment(@project_feature, rid, 'responsible') if rid.present?
          create_assignment(@project_feature, aid, 'accountable') if aid.present?
        end
      end

      notices = ['Feature updated successfully.']
      if @project_feature.can_edit_details?(current_user) && params[:tasks].present?
        task_rows = Array(params[:tasks]).map(&:to_unsafe_h)
        creator = ProjectFeatureBulkCreator.new(
          project: @project,
          creator: current_user,
          feature_name: @project_feature.name,
          task_rows: task_rows
        )
        if creator.planned_tasks.any?
          if params[:proceed_overlaps].to_s != 'true' && creator.overlap_messages.any?
            flash.now[:overlap_details] = creator.overlap_messages.join("\n")
            @add_tasks_overlap_retry = true
            @submitted_add_tasks = task_rows
            prepare_feature_show
            render :show, status: :unprocessable_entity
            return
          end

          result = creator.append_to_feature!(@project_feature, proceed_overlaps: params[:proceed_overlaps].to_s == 'true')
          case result[:status]
          when :success
            notices << 'New tasks were added.'
          when :overlap
            flash.now[:overlap_details] = Array(result[:overlaps]).join("\n")
            @add_tasks_overlap_retry = true
            @submitted_add_tasks = task_rows
            prepare_feature_show
            render :show, status: :unprocessable_entity
            return
          else
            flash.now[:alert] = result[:errors]&.join(', ') || 'Could not add tasks.'
            @submitted_add_tasks = task_rows
            prepare_feature_show
            render :show, status: :unprocessable_entity
            return
          end
        end
      end

      redirect_to project_project_feature_path(@project, @project_feature), notice: notices.join(' ')
    else
      prepare_feature_show
      render :show, status: :unprocessable_entity
    end
  end

  def new_from_tasks
    ids = Array(params[:task_ids]).map(&:to_i).reject(&:zero?)
    if ids.empty?
      redirect_to project_path(@project), alert: 'Select at least one task.'
      return
    end
    @tasks = @project.tasks.where(id: ids, project_feature_id: nil).order(:name)
    if @tasks.count != ids.size
      redirect_to project_path(@project), alert: 'Some tasks could not be found or already belong to a feature.'
      return
    end
    @project_feature = @project.project_features.build
  end

  def create_from_tasks
    ids = Array(params[:task_ids]).map(&:to_i).reject(&:zero?)
    name = params.require(:project_feature).permit(:name)[:name].to_s.strip
    if name.blank?
      redirect_to new_from_tasks_project_project_features_path(@project, task_ids: ids), alert: 'Feature name is required.'
      return
    end
    tasks = @project.tasks.where(id: ids, project_feature_id: nil)
    if tasks.count != ids.size
      redirect_to project_path(@project), alert: 'Invalid task selection. Only tasks without a feature can be grouped.'
      return
    end

    duplicate_names = tasks.group_by(&:name).select { |_name, grouped_tasks| grouped_tasks.size > 1 }.keys
    if duplicate_names.any?
      redirect_to new_from_tasks_project_project_features_path(@project, task_ids: ids),
                  alert: "Tasks grouped into one feature must have unique names. Duplicate: #{duplicate_names.to_sentence}."
      return
    end

    dated = tasks.select { |t| t.start_date.present? && t.end_date.present? }
    fs = dated.map(&:start_date).min || Date.current
    fe = dated.map(&:end_date).max || fs

    feature = nil
    ActiveRecord::Base.transaction do
      feature = @project.project_features.create!(name: name, start_date: fs, end_date: fe, status: 'not_started')
      tasks.each { |t| t.update!(project_feature_id: feature.id) }
    end

    redirect_to project_project_feature_path(@project, feature), notice: 'Feature created and tasks grouped successfully.'
  end

  def new_with_tasks
    redirect_to new_project_project_feature_path(@project)
  end

  def create_with_tasks
    name = params.require(:project_feature).permit(:name)[:name].to_s.strip
    task_rows = Array(params[:tasks]).map(&:to_unsafe_h)
    template_mode = params[:bulk_create_mode] == 'template' || params[:commit].to_s == 'Create with template'

    if template_mode
      create_feature_from_template_bulk(name)
      return
    end

    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: current_user,
      feature_name: name,
      task_rows: task_rows
    )

    if creator.validation_errors.any?
      if json_request?
        render json: { status: 'error', errors: creator.validation_errors }, status: :unprocessable_entity
      else
        prepare_new_feature_form(name: name, submitted_tasks: task_rows)
        flash.now[:alert] = creator.validation_errors.join(', ')
        render :new, status: :unprocessable_entity
      end
      return
    end

    if params[:proceed_overlaps].to_s != 'true' && creator.overlap_messages.any?
      if json_request?
        render json: { status: 'overlap_warning', overlaps: creator.overlap_messages }, status: :conflict
        return
      end

      flash.now[:overlap_details] = creator.overlap_messages.join("\n")
      @overlap_retry = true
      prepare_new_feature_form(name: name, submitted_tasks: task_rows)
      render :new, status: :unprocessable_entity
      return
    end

    result = creator.create!(proceed_overlaps: params[:proceed_overlaps].to_s == 'true')
    if result[:status] == :success
      if json_request?
        render json: {
          status: 'success',
          redirect_url: project_project_feature_path(@project, result[:feature]),
          message: 'Feature and tasks were created.'
        }
      else
        redirect_to project_project_feature_path(@project, result[:feature]), notice: 'Feature and tasks were created.'
      end
    else
      if json_request?
        render json: { status: 'error', errors: result[:errors] || ['Could not create feature.'] }, status: :unprocessable_entity
      else
        prepare_new_feature_form(name: name, submitted_tasks: task_rows)
        flash.now[:alert] = result[:errors]&.join(', ') || 'Could not create feature.'
        render :new, status: :unprocessable_entity
      end
    end
  end

  def create_from_timeline
    name = params[:feature_name].to_s.strip
    task_rows = timeline_task_rows_param

    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: current_user,
      feature_name: name,
      task_rows: task_rows
    )

    if params[:proceed_overlaps].to_s != 'true' && creator.overlap_messages.any?
      render json: { status: 'overlap_warning', overlaps: creator.overlap_messages }, status: :conflict
      return
    end

    result = creator.create!(proceed_overlaps: params[:proceed_overlaps].to_s == 'true')
    case result[:status]
    when :success
      render json: {
        status: 'success',
        feature_id: result[:feature].id,
        task_ids: result[:tasks].map(&:id)
      }
    when :overlap
      render json: { status: 'overlap_warning', overlaps: result[:overlaps] }, status: :conflict
    else
      render json: { status: 'error', errors: result[:errors] || ['Unknown error'] }, status: :unprocessable_entity
    end
  end

  def save_as_template
    unless @project_feature.can_edit_details?(current_user)
      redirect_to project_project_feature_path(@project, @project_feature), alert: 'You cannot create a template from this feature.'
      return
    end

    tasks_data = @project_feature.tasks.top_level.order(:order, :id).map do |t|
      dur = if t.start_date && t.end_date
              (t.end_date - t.start_date).to_i + 1
            else
              (t.duration.presence || 1).to_i
            end
      {
        'name' => t.name,
        'duration' => dur,
        'priority' => t.priority,
        'responsible_user_id' => t.responsible_users.first&.id,
        'accountable_user_id' => t.accountable_users.first&.id
      }
    end

    template_name = "#{@project_feature.name} — template"
    template = current_user.feature_templates.create!(name: template_name, tasks_data: tasks_data)

    redirect_to edit_feature_template_path(template), notice: 'Template created. You can rename it and adjust task rows below.'
  rescue ActiveRecord::RecordInvalid => e
    redirect_to project_project_feature_path(@project, @project_feature), alert: e.record.errors.full_messages.join(', ')
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

  def prepare_feature_show
    @is_project_creator = @project.user == current_user
    @feature_tasks = @project_feature.tasks.top_level
      .includes(responsible_assignments: :user, accountable_assignments: :user)
      .order(:order, :start_date, :created_at)

    return unless @project_feature.can_edit?(current_user)

    load_contributors
    @project_feature.responsible_user_id = @project_feature.responsible_contributors.first&.id
    @project_feature.accountable_user_id = @project_feature.accountable_contributors.first&.id
  end

  def prepare_new_feature_form(name:, submitted_tasks: nil)
    @project_feature = @project.project_features.build(name: name)
    @submitted_tasks = submitted_tasks if submitted_tasks
    @task_templates_json = current_user.feature_templates.order(created_at: :desc).map { |t| { id: t.id, name: t.name } }
    load_contributors
  end

  def default_bulk_task_rows_from_params
    rows = Array(params[:tasks]).map(&:to_unsafe_h)
    rows.presence || Array.new(5) { {} }
  end

  def json_request?
    request.format.json? || request.headers['Accept'].to_s.include?('application/json')
  end

  def create_feature_from_template_bulk(name)
    template_id = params[:template_id].presence
    anchor_str = params[:template_anchor_date].to_s.strip
    template = current_user.feature_templates.find_by(id: template_id)

    if name.blank?
      if json_request?
        render json: { status: 'error', errors: ['Feature name is required.'] }, status: :unprocessable_entity
        return
      end

      @template_id_for_form = template_id
      @template_anchor_for_form = anchor_str.presence
      prepare_new_feature_form(name: name, submitted_tasks: default_bulk_task_rows_from_params)
      flash.now[:alert] = 'Feature name is required.'
      render :new, status: :unprocessable_entity
      return
    end

    unless template && anchor_str.present?
      if json_request?
        render json: { status: 'error', errors: ['Choose a template and the date when the first task starts.'] }, status: :unprocessable_entity
        return
      end

      @template_id_for_form = template_id
      @template_anchor_for_form = anchor_str.presence
      prepare_new_feature_form(name: name, submitted_tasks: default_bulk_task_rows_from_params)
      flash.now[:alert] = 'Choose a template and the date when the first task starts.'
      render :new, status: :unprocessable_entity
      return
    end

    anchor_date = Date.parse(anchor_str) rescue nil
    unless anchor_date
      if json_request?
        render json: { status: 'error', errors: ['Invalid start date.'] }, status: :unprocessable_entity
        return
      end

      @template_id_for_form = template_id
      @template_anchor_for_form = anchor_str
      prepare_new_feature_form(name: name, submitted_tasks: default_bulk_task_rows_from_params)
      flash.now[:alert] = 'Invalid start date.'
      render :new, status: :unprocessable_entity
      return
    end

    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: current_user,
      feature_name: name,
      task_rows: [],
      template: template,
      anchor_date: anchor_date,
      from_template_only: true
    )

    if creator.validation_errors.any?
      if json_request?
        render json: { status: 'error', errors: creator.validation_errors }, status: :unprocessable_entity
      else
        @bulk_create_mode = 'template'
        @template_id_for_form = template_id.to_s
        @template_anchor_for_form = anchor_str
        prepare_new_feature_form(name: name, submitted_tasks: Array.new(5) { {} })
        flash.now[:alert] = creator.validation_errors.join(', ')
        render :new, status: :unprocessable_entity
      end
      return
    end

    if params[:proceed_overlaps].to_s != 'true' && creator.overlap_messages.any?
      if json_request?
        render json: { status: 'overlap_warning', overlaps: creator.overlap_messages }, status: :conflict
        return
      end

      flash.now[:overlap_details] = creator.overlap_messages.join("\n")
      @overlap_retry = true
      @bulk_create_mode = 'template'
      @template_id_for_form = template_id.to_s
      @template_anchor_for_form = anchor_str
      prepare_new_feature_form(name: name, submitted_tasks: Array.new(5) { {} })
      render :new, status: :unprocessable_entity
      return
    end

    result = creator.create!(proceed_overlaps: params[:proceed_overlaps].to_s == 'true')
    if result[:status] == :success
      if json_request?
        render json: {
          status: 'success',
          redirect_url: project_project_feature_path(@project, result[:feature]),
          message: 'Feature and tasks were created from the template.'
        }
      else
        redirect_to project_project_feature_path(@project, result[:feature]), notice: 'Feature and tasks were created from the template.'
      end
    else
      if json_request?
        render json: { status: 'error', errors: result[:errors] || ['Could not create feature.'] }, status: :unprocessable_entity
      else
        @bulk_create_mode = 'template'
        @template_id_for_form = template_id.to_s
        @template_anchor_for_form = anchor_str
        prepare_new_feature_form(name: name, submitted_tasks: Array.new(5) { {} })
        flash.now[:alert] = result[:errors]&.join(', ') || 'Could not create feature.'
        render :new, status: :unprocessable_entity
      end
    end
  end

  def ensure_project_manager_for_bulk
    return if @project.user == current_user

    if json_request?
      render json: { status: 'error', errors: ['Forbidden'] }, status: :forbidden
    else
      redirect_to project_path(@project), alert: 'Only the project manager can do that.'
    end
    return
  end

  def timeline_task_rows_param
    raw = params[:tasks]
    return [] if raw.blank?

    Array(raw).map do |row|
      row.respond_to?(:permit) ? row.permit(:name, :start_date, :end_date, :responsible_user_id).to_h : row.to_h
    end
  end

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
    allowed = [:name, :duration, :start_date, :responsible_user_id, :accountable_user_id]
    if params[:project_feature].present?
      params.require(:project_feature).permit(*allowed)
    else
      ActionController::Parameters.new.permit(*allowed)
    end
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
end
