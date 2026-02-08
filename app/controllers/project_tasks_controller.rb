class ProjectTasksController < ApplicationController
  before_action :set_project
  before_action :authenticate_user!
  before_action :set_task, only: [:show, :update, :destroy]

  def new
    # Only project manager can create tasks
    unless @project.user == current_user
      redirect_to project_path(@project), alert: 'Only the project manager can create tasks.'
      return
    end
    
    @task = @project.tasks.build
    @all_users = User.all
    @project_features = @project.project_features.order(:name)
  end

  def show
    @all_users = User.all
    @project_features = @project.project_features.order(:name)
  end

  def update
    # Handle field updates from inline editing
    if params[:field].present?
      unless can_edit_task?
        render json: { status: 'error', errors: ['You do not have permission to edit this task.'] }, status: :unauthorized
        return
      end

      field_name = params[:field]

      if params[:value].present? || ['start_date', 'end_date', 'project_feature_id', 'priority', 'date_range', 'time_range'].include?(field_name)
        case field_name
        when 'name'
          @task.name = params[:value]
        when 'duration'
          @task.duration = params[:value].to_i if params[:value].present?
          if @task.start_date.present? && @task.duration.present?
            @task.end_date = @task.start_date + @task.duration.days
          end
        when 'start_date'
          if params[:value].present? && params[:value].to_s.strip != ''
            parsed_date = Date.parse(params[:value].to_s.strip) rescue nil
            unless parsed_date
              render json: { status: 'error', errors: ['Invalid date format'] }, status: :unprocessable_entity
              return
            end
            @task.start_date = parsed_date
          else
            @task.start_date = nil
          end
        when 'end_date'
          if params[:value].present? && params[:value].to_s.strip != ''
            parsed_date = Date.parse(params[:value].to_s.strip) rescue nil
            unless parsed_date
              render json: { status: 'error', errors: ['Invalid date format'] }, status: :unprocessable_entity
              return
            end
            @task.end_date = parsed_date
          else
            @task.end_date = nil
          end
        when 'start_time'
          @task.start_time = parse_time_value(params[:value])
        when 'end_time'
          @task.end_time = parse_time_value(params[:value])
        when 'date_range'
          start_date = params[:start_date].presence
          end_date = params[:end_date].presence
          if start_date
            parsed_date = Date.parse(start_date.to_s.strip) rescue nil
            unless parsed_date
              render json: { status: 'error', errors: ['Invalid start date format'] }, status: :unprocessable_entity
              return
            end
            @task.start_date = parsed_date
          end
          if end_date
            parsed_date = Date.parse(end_date.to_s.strip) rescue nil
            unless parsed_date
              render json: { status: 'error', errors: ['Invalid end date format'] }, status: :unprocessable_entity
              return
            end
            @task.end_date = parsed_date
          end
        when 'time_range'
          start_time = params[:start_time].presence
          end_time = params[:end_time].presence
          @task.start_time = parse_time_value(start_time)
          @task.end_time = parse_time_value(end_time)
        when 'status'
          @task.status = params[:value]
        when 'priority'
          @task.priority = params[:value].presence
        when 'project_feature_id'
          @task.project_feature_id = params[:value].presence
        when 'responsible_user_id'
          update_task_assignment('responsible', params[:value])
        when 'accountable_user_id'
          update_task_assignment('accountable', params[:value])
        end

        if overlap_warning_required?(field_name)
          overlaps = overlapping_tasks_for_responsible
          if overlaps.any? && params[:proceed].to_s != 'true'
            render json: {
              status: 'overlap_warning',
              message: 'This contributor already has a task overlapping in time with this one.',
              overlaps: overlaps.map { |t| { id: t.id, name: t.name } }
            }, status: :conflict
            return
          end
        end

        saved = @task.save

        if saved
          @task.reload

          response_value = case field_name
          when 'start_date', 'end_date'
            @task.send(field_name)&.strftime('%Y-%m-%d') || 'Not set'
          when 'start_time', 'end_time'
            @task.send(field_name)&.strftime('%H:%M') || 'Not set'
          when 'time_range'
            {
              start_time: @task.start_time&.strftime('%H:%M') || 'Not set',
              end_time: @task.end_time&.strftime('%H:%M') || 'Not set'
            }
          when 'date_range'
            {
              start_date: @task.start_date&.strftime('%Y-%m-%d') || 'Not set',
              end_date: @task.end_date&.strftime('%Y-%m-%d') || 'Not set'
            }
          when 'duration'
            @task.duration.present? ? "#{@task.duration} #{@task.duration == 1 ? 'day' : 'days'}" : 'Not set'
          when 'status'
            case @task.status
            when 'work_in_progress'
              'On Going'
            when 'stand_by'
              'Stand By'
            else
              @task.status.humanize
            end
          when 'priority'
            @task.priority.present? ? @task.priority.humanize : 'Not set'
          when 'project_feature_id'
            @task.project_feature&.name || 'Not assigned'
          when 'responsible_user_id', 'accountable_user_id'
            contributor = field_name == 'responsible_user_id' ? @task.responsible_users.first : @task.accountable_users.first
            if contributor
              "#{contributor.name}#{contributor.job.present? ? " - #{contributor.job}" : ''}"
            else
              'Not assigned'
            end
          else
            @task.send(field_name) || 'Not set'
          end

          render json: { status: 'success', value: response_value, formatted_value: response_value }
        else
          render json: { status: 'error', errors: @task.errors.full_messages }, status: :unprocessable_entity
        end

        return
      end
    end

    head :bad_request
  end

  def create
    # Only project manager can create tasks
    unless @project.user == current_user
      redirect_to project_path(@project), alert: 'Only the project manager can create tasks.'
      return
    end
    
    # Build task params
    task_params = task_params_without_assignments
    task_params[:project_id] = @project.id
    task_params[:status] = 'not_started'
    
    # Convert empty strings to nil for date fields and priority
    task_params[:start_date] = nil if task_params[:start_date].blank?
    task_params[:end_date] = nil if task_params[:end_date].blank?
    task_params[:start_time] = nil if task_params[:start_time].blank?
    task_params[:end_time] = nil if task_params[:end_time].blank?
    task_params[:priority] = nil if task_params[:priority].blank?
    
    # Determine if task should be in backlog (no dates = backlog)
    start_date = task_params[:start_date].present? ? Date.parse(task_params[:start_date]) : nil rescue nil
    end_date = task_params[:end_date].present? ? Date.parse(task_params[:end_date]) : nil rescue nil
    
    if start_date.nil? && end_date.nil?
      # No dates = backlog
      task_params[:backlog_type] = 'project'
      task_params[:start_date] = nil
      task_params[:end_date] = nil
    else
      # Has dates = regular task (not in backlog)
      task_params[:backlog_type] = nil
      # If only one date is provided, calculate the other based on duration
      if start_date.present? && end_date.nil? && task_params[:duration].present?
        task_params[:end_date] = start_date + task_params[:duration].to_i.days
      elsif end_date.present? && start_date.nil? && task_params[:duration].present?
        task_params[:start_date] = end_date - task_params[:duration].to_i.days
      end
    end

    @task = Task.new(task_params)

    # Overlap warning for responsible contributor
    if params[:proceed].to_s != 'true'
      responsible_id = params[:task][:responsible_user_id].presence
      overlaps = overlapping_tasks_for_create(responsible_id)
      if overlaps.any?
        respond_to do |format|
          format.json do
            render json: {
              status: 'overlap_warning',
              message: 'This contributor already has a task overlapping in time with this one.',
              overlaps: overlaps.map { |t| { id: t.id, name: t.name } }
            }, status: :conflict
          end
          format.html do
            @all_users = User.all
            @project_features = @project.project_features.order(:name)
            flash.now[:alert] = 'This contributor already has a task overlapping in time with this one.'
            render :new, status: :unprocessable_entity
          end
        end
        return
      end
    end

    if @task.save
      # Create responsible assignment if provided
      if params[:task][:responsible_user_id].present?
        @task.task_assignments.create!(
          user_id: params[:task][:responsible_user_id],
          role: 'responsible'
        )
      end

      # Create accountable assignment if provided
      if params[:task][:accountable_user_id].present?
        @task.task_assignments.create!(
          user_id: params[:task][:accountable_user_id],
          role: 'accountable'
        )
      end

      respond_to do |format|
        format.html do
          if @task.in_backlog?
            redirect_to project_path(@project), notice: 'Task created and added to backlog successfully.'
          else
            redirect_to project_path(@project), notice: 'Task created successfully.'
          end
        end
        format.json { render json: { status: 'success', task: @task }, status: :created }
      end
    else
      @all_users = User.all
      @project_features = @project.project_features.order(:name)
      
      respond_to do |format|
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: { status: 'error', errors: @task.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    unless @project.user == current_user
      redirect_to project_path(@project), alert: 'Only the project manager can delete tasks.'
      return
    end

    @task.destroy
    redirect_to project_path(@project), notice: 'Task deleted successfully.'
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  rescue ActiveRecord::RecordNotFound
    redirect_to projects_path, alert: 'Project not found'
  end

  def set_task
    @task = @project.tasks.includes(
      :responsible_users,
      :accountable_users,
      :project_feature
    ).find(params[:id])
  rescue ActiveRecord::RecordNotFound
    redirect_to project_path(@project), alert: 'Task not found'
  end

  def update_task_assignment(role, user_id)
    @task.task_assignments.where(role: role).delete_all
    return if user_id.blank? || user_id == '0'

    @task.task_assignments.create!(user_id: user_id, role: role)
  end

  def can_edit_task?
    return true if @project.user == current_user

    @task.responsible_users.include?(current_user) || @task.accountable_users.include?(current_user)
  end

  def overlap_warning_required?(field_name)
    @task.start_date.present? && @task.end_date.present? &&
      ['start_date', 'end_date', 'date_range', 'responsible_user_id'].include?(field_name)
  end

  def overlapping_tasks_for_responsible
    responsible_ids = if params[:field] == 'responsible_user_id'
      params[:value].present? && params[:value] != '0' ? [params[:value].to_i] : []
    else
      @task.responsible_users.pluck(:id)
    end

    return [] if responsible_ids.empty?

    Task.joins(:responsible_assignments)
        .where(project_id: @project.id)
        .where(task_assignments: { user_id: responsible_ids, role: 'responsible' })
        .where.not(id: @task.id)
        .where.not(start_date: nil, end_date: nil)
        .where('start_date <= ? AND end_date >= ?', @task.end_date, @task.start_date)
        .distinct
  end

  def parse_time_value(time_value)
    return nil if time_value.blank?
    Time.zone ? Time.zone.parse(time_value) : Time.parse(time_value)
  rescue ArgumentError, TypeError
    nil
  end

  def overlapping_tasks_for_create(responsible_id)
    return [] if responsible_id.blank?
    return [] if @task.start_date.blank? || @task.end_date.blank?

    Task.joins(:responsible_assignments)
        .where(project_id: @project.id)
        .where(task_assignments: { user_id: responsible_id.to_i, role: 'responsible' })
        .where.not(start_date: nil, end_date: nil)
        .where('start_date <= ? AND end_date >= ?', @task.end_date, @task.start_date)
        .distinct
  end

  def task_params_without_assignments
    params.require(:task).permit(:name, :duration, :start_date, :end_date, :start_time, :end_time, :priority, :project_feature_id)
  end
end

