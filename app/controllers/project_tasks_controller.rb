class ProjectTasksController < ApplicationController
  before_action :set_project
  before_action :authenticate_user!
  before_action :set_task, only: [:show, :update, :destroy, :apply_default_template]

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
    @outgoing_task_links = @task.outgoing_task_links.includes(:target_task)
  end

  def update
    # Handle field updates from inline editing
    if params[:field].present?
      unless can_edit_task?
        render json: { status: 'error', errors: ['You do not have permission to edit this task.'] }, status: :unauthorized
        return
      end

      field_name = params[:field]
      original_start_date = @task.start_date
      original_end_date = @task.end_date

      if params[:value].present? || ['start_date', 'end_date', 'project_feature_id', 'priority', 'date_range', 'time_range'].include?(field_name)
        case field_name
        when 'name'
          @task.name = params[:value]
        when 'duration'
          @task.duration = params[:value].to_i if params[:value].present?
          if @task.start_date.present? && @task.duration.present?
            @task.end_date = @task.start_date + (@task.duration - 1).days
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

        link_context = build_link_context(original_start_date, original_end_date, @task.start_date, @task.end_date, field_name)
        if task_link_warning_required?(field_name)
          if link_context[:shift_linked] && params[:link_decision].blank?
            tasks_to_move, _ = collect_linked_tasks_for_shift(@task)
            tasks_for_modal = tasks_to_move.map { |t| { id: t.id, name: t.name } }
            render json: {
              status: 'linked_shift_warning',
              message: linked_shift_warning_message(link_context),
              linked_tasks: link_context[:linked_tasks],
              tasks_to_move: tasks_for_modal
            }, status: :conflict
            return
          end
          if link_context[:shift_forward_linked] && params[:link_decision].blank?
            tasks_to_move, _ = collect_linked_tasks_for_shift(@task)
            tasks_for_modal = tasks_to_move.map { |t| { id: t.id, name: t.name } }
            render json: {
              status: 'linked_shift_forward_warning',
              message: linked_shift_forward_warning_message(link_context),
              linked_tasks: link_context[:linked_tasks],
              tasks_to_move: tasks_for_modal
            }, status: :conflict
            return
          end
          if link_context[:warn] && params[:link_decision].blank?
            render json: {
              status: 'linked_warning',
              message: linked_warning_message(link_context),
              linked_tasks: link_context[:linked_tasks]
            }, status: :conflict
            return
          end
        end

        # Linked shift must run before saving the primary task. If we save first and return 409 for
        # linked overlap, the DB already has the new dates; retries see delta_days == 0 and never move
        # linked tasks. Shift + save stay in one transaction so a failed save rolls back link moves.
        link_shift_conflict = nil
        linked_updates = nil
        linked_notice = nil
        saved = false

        ApplicationRecord.transaction do
          if task_link_warning_required?(field_name) && params[:link_decision] == 'shift'
            shift_result = handle_link_shift(original_start_date, @task.start_date)
            if shift_result[:status].to_s == 'overlap_warning'
              link_shift_conflict = { kind: :overlap_warning, result: shift_result }
              raise ActiveRecord::Rollback
            elsif shift_result[:status].to_s == 'project_start_warning'
              link_shift_conflict = { kind: :project_start_warning, result: shift_result }
              raise ActiveRecord::Rollback
            end
            linked_updates = shift_result[:updates]
            linked_notice = shift_result[:notice]
          end

          saved = @task.save
          unless saved
            raise ActiveRecord::Rollback
          end

          if params[:field] == 'date_range' && @task.start_date && @task.end_date
            @task.update_columns(duration: (@task.end_date - @task.start_date).to_i + 1, updated_at: Time.current)
          end

          if params[:field] == 'date_range' && params.key?(:responsible_user_id)
            @task.task_assignments.where(role: 'responsible').delete_all
            rid = params[:responsible_user_id]
            if rid.present? && rid.to_s != '0'
              @task.task_assignments.create!(user_id: rid.to_i, role: 'responsible')
            end
          end

          update_task_segments_for_duration_change(original_start_date, original_end_date)

          if task_link_warning_required?(field_name)
            if params[:link_decision] == 'shift'
              # updates already applied inside handle_link_shift
            elsif params[:link_decision] == 'skip'
              linked_updates = nil
              linked_notice = nil
            elsif params[:link_decision].present?
              linked_updates, linked_notice = handle_link_decision(params[:link_decision], link_context)
            end
          end
          @task.reload
        end

        if link_shift_conflict
          payload = link_shift_conflict[:result]
          if link_shift_conflict[:kind] == :overlap_warning
            render json: { status: 'overlap_warning', message: payload[:message], overlap_context: 'linked_shift' }, status: :conflict
          else
            render json: { status: 'project_start_warning', message: payload[:message] }, status: :conflict
          end
          return
        end

        if saved

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

          segments_payload = nil
          checkpoints_payload = nil
          if ['start_date', 'end_date', 'date_range', 'duration'].include?(field_name)
            segments_payload = @task.task_segments.order(:start_day).map do |s|
              {
                id: s.id,
                name: s.name,
                start_day: s.start_day.to_f,
                end_day: s.end_day.to_f,
                color: s.color,
                default_percent: s.default_percent,
                percent_flagged: s.percent_flagged
              }
            end
            checkpoints_payload = @task.task_checkpoints.order(:day).map do |c|
              { id: c.id, day: c.day, name: c.name }
            end
          end

          json_response = {
            status: 'success',
            value: response_value,
            formatted_value: response_value,
            linked_updates: linked_updates,
            linked_notice: linked_notice,
            segments: segments_payload,
            checkpoints: checkpoints_payload
          }
          if ['start_date', 'end_date', 'date_range', 'duration'].include?(field_name) && @task.start_date && @task.end_date
            json_response[:start_date] = @task.start_date.strftime('%Y-%m-%d')
            json_response[:end_date] = @task.end_date.strftime('%Y-%m-%d')
          end
          if field_name == 'date_range' && params.key?(:responsible_user_id)
            json_response[:responsible_users] = @task.responsible_users.map { |u| { id: u.id, name: u.name.to_s } }
            json_response[:accountable_users] = @task.accountable_users.map { |u| { id: u.id, name: u.name.to_s } }
          end
          render json: json_response
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
        task_params[:end_date] = start_date + (task_params[:duration].to_i - 1).days
      elsif end_date.present? && start_date.nil? && task_params[:duration].present?
        task_params[:start_date] = end_date - (task_params[:duration].to_i - 1).days
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
      if params[:apply_template].to_s == 'true'
        apply_default_segment_template(@task)
      end
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

  def apply_default_template
    unless can_edit_task?
      render json: { status: 'error', errors: ['You do not have permission to edit this task.'] }, status: :unauthorized
      return
    end

    if apply_default_segment_template(@task, reset: true)
      render json: { status: 'success' }
    else
      render json: { status: 'error', errors: ['Template requires a duration of at least 5 days.'] }, status: :unprocessable_entity
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
      :project_feature,
      :task_segments,
      :task_checkpoints,
      :incoming_task_link
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
    return false unless %w[start_date end_date date_range responsible_user_id].include?(field_name)

    @task.start_date.present? && @task.end_date.present?
  end

  def task_link_warning_required?(field_name)
    ['start_date', 'end_date', 'date_range', 'duration'].include?(field_name)
  end

  def update_task_segments_for_duration_change(original_start, original_end)
    return unless original_start && original_end && @task.start_date && @task.end_date
    old_duration = (original_end - original_start).to_i + 1
    new_duration = (@task.end_date - @task.start_date).to_i + 1
    return if old_duration <= 0 || new_duration <= 0
    return if old_duration == new_duration
    return if @task.task_segments.empty? && @task.task_checkpoints.empty?

    # Resize from remembered default_percent targets (not prior geometry ratios), so e.g. four
    # × 25% segments return to equal quarters when the duration again divides evenly.
    segments = @task.task_segments.order(:start_day, :id).to_a
    percents = segments.map do |segment|
      p = segment.default_percent
      if p.nil?
        p = segment_percent(segment.start_day, segment.end_day, old_duration)
      end
      p.to_f
    end
    total_pct = percents.sum
    percents = percents.map { |p| total_pct > 0 ? (p * 100.0 / total_pct) : (100.0 / segments.size) }

    ideal_spans = percents.map { |p| new_duration * p / 100.0 }
    spans = fit_half_day_spans_to_total_days(ideal_spans, new_duration)

    cursor = 1.0
    segments.each_with_index do |segment, i|
      span = spans[i]
      start_day = round_to_half_day(cursor)
      end_day = round_to_half_day(cursor + span - 1.0)
      end_day = [[end_day, start_day].max, new_duration.to_f].min

      stored_default = segment.default_percent
      stored_default ||= segment_percent(segment.start_day, segment.end_day, old_duration)

      actual_percent = segment_percent(start_day, end_day, new_duration)
      flagged = (stored_default.to_f.round(1) != actual_percent.round(1))
      segment.update_columns(
        start_day: start_day,
        end_day: end_day,
        default_percent: stored_default,
        percent_flagged: flagged,
        updated_at: Time.current
      )

      cursor = end_day + 1.0
    end

    @task.task_checkpoints.each do |checkpoint|
      ratio = checkpoint.day.to_f / old_duration
      new_day = (ratio * new_duration).round
      max_day = new_duration > 1 ? (new_duration - 1) : 1
      new_day = [[new_day, 1].max, max_day].min
      checkpoint.update_columns(day: new_day, updated_at: Time.current)
    end
  end

  def round_to_half_day(value)
    whole = value.floor
    frac = value - whole
    return value if frac == 0
    if frac <= 0.5
      whole + 0.5
    else
      whole + 1.0
    end
  end

  # Given ideal span lengths in days that sum to +total_days+ (approximately), return spans in
  # ½-day increments whose lengths sum exactly to +total_days+ (largest remainder on half-day units).
  def fit_half_day_spans_to_total_days(ideal_span_days, total_days)
    td = total_days.to_f
    half_total = (td * 2).round
    raw_halves = ideal_span_days.map { |d| d * 2.0 }
    int_halves = raw_halves.map(&:floor)
    halves = int_halves.map(&:to_i)
    remainder = half_total - halves.sum
    by_frac_desc = raw_halves.each_with_index.map { |r, i| [r - r.floor, i] }.sort_by { |a| -a[0] }
    by_frac_asc = by_frac_desc.reverse
    if remainder.positive?
      remainder.times { |j| halves[by_frac_desc[j % by_frac_desc.length][1]] += 1 }
    elsif remainder.negative?
      (-remainder).times { |j| halves[by_frac_asc[j % by_frac_asc.length][1]] -= 1 }
    end
    halves.map { |h| h / 2.0 }
  end

  def segment_percent(start_day, end_day, duration)
    return 0.0 if duration.to_f <= 0
    days = end_day.to_f - start_day.to_f + 1.0
    ((days / duration.to_f) * 100).round(1)
  end

  def build_link_context(original_start, original_end, new_start, new_end, field_name)
    context = {
      warn: false,
      warn_incoming: false,
      warn_outgoing: false,
      break_incoming: false,
      break_outgoing: false,
      shift_linked: false,
      shift_forward_linked: false,
      linked_tasks: []
    }

    # Moving back in time: linked tasks may need to shift back
    if original_start && new_start && new_start < original_start
      linked = linked_tasks_for_shift(backward: true)
      if linked.any?
        context[:shift_linked] = true
        context[:linked_tasks] = linked
        return context
      end
    end

    # Moving forward in time: linked tasks may need to shift forward
    if original_start && new_start && new_start > original_start
      linked = linked_tasks_for_shift(backward: false)
      if linked.any?
        context[:shift_forward_linked] = true
        context[:linked_tasks] = linked
        return context
      end
    end

    incoming = @task.incoming_task_link
    if incoming&.source_task&.start_date && new_start
      expected_start = incoming.source_task.start_date + (incoming.anchor_day - 1).days + (incoming.offset_days || 0).days
      if new_start > expected_start
        context[:break_incoming] = true
        context[:linked_tasks] << { id: incoming.source_task.id, name: incoming.source_task.name }
      elsif new_start < expected_start
        context[:warn_incoming] = true
        context[:linked_tasks] << { id: incoming.source_task.id, name: incoming.source_task.name }
      end
    end

    if original_end && new_end && new_end != original_end
      links = TaskLink.includes(:target_task).where(source_task_id: @task.id)
      if links.any?
        if new_end > original_end
          context[:warn_outgoing] = true
          context[:linked_tasks].concat(links.map { |l| { id: l.target_task_id, name: l.target_task&.name } })
        else
          context[:break_outgoing] = true
          context[:linked_tasks].concat(links.map { |l| { id: l.target_task_id, name: l.target_task&.name } })
        end
      end
    end

    context[:warn] = context[:warn_incoming] || context[:warn_outgoing]
    context[:linked_tasks].compact!
    context
  end

  def linked_tasks_for_shift(backward: true)
    linked = []
    incoming = @task.incoming_task_link
    linked << { id: incoming.source_task.id, name: incoming.source_task.name } if incoming&.source_task
    TaskLink.includes(:target_task).where(source_task_id: @task.id).each do |link|
      linked << { id: link.target_task_id, name: link.target_task&.name }
    end
    linked.compact.uniq { |t| t[:id] }
  end

  def linked_shift_warning_message(context)
    names = context[:linked_tasks].map { |t| t[:name] }.compact
    return 'This task is linked to other tasks. Move the linked tasks back in time as well?' if names.empty?
    "This task is linked to #{names.join(', ')}. Move the linked tasks back in time as well?"
  end

  def linked_shift_forward_warning_message(context)
    names = context[:linked_tasks].map { |t| t[:name] }.compact
    return 'This task is linked to other tasks. Move the linked tasks forward as well?' if names.empty?
    "This task is linked to #{names.join(', ')}. Move the linked tasks forward as well?"
  end

  def handle_link_shift(original_start, new_start)
    return { status: :ok, updates: nil, notice: nil } unless original_start && new_start
    delta_days = (new_start - original_start).to_i
    return { status: :ok, updates: nil, notice: nil } if delta_days == 0

    tasks_to_move, links_to_break = collect_linked_tasks_for_shift(@task)
    all_chain_ids = [@task.id] + tasks_to_move.map(&:id)

    # Filter by user selection if task_ids_to_shift provided (empty array = move none)
    if params.key?(:task_ids_to_shift)
      selected_ids = Array(params[:task_ids_to_shift]).map(&:to_i).reject(&:zero?)
      tasks_to_move = tasks_to_move.select { |t| selected_ids.include?(t.id) }
      moving_ids = [@task.id] + tasks_to_move.map(&:id)
      not_moving_ids = all_chain_ids - moving_ids
      not_moving_ids.each do |id|
        TaskLink.where(source_task_id: id).or(TaskLink.where(target_task_id: id)).each do |link|
          other_id = link.source_task_id == id ? link.target_task_id : link.source_task_id
          links_to_break << link if moving_ids.include?(other_id)
        end
      end
      links_to_break.uniq!
    end

    if tasks_to_move.empty?
      links_to_break.each(&:destroy)
      return { status: :ok, updates: nil, notice: break_links_notice(links_to_break) }
    end

    proposed = tasks_to_move.map do |task|
      {
        task: task,
        start_date: task.start_date + delta_days.days,
        end_date: task.end_date + delta_days.days
      }
    end

    overlap_names = overlaps_for_shift(proposed, tasks_to_move.map(&:id) + [@task.id])
    if overlap_names.any?
      if params[:overlap_decision].to_s == 'break'
        tasks_to_move.each do |task|
          TaskLink.where(source_task_id: @task.id, target_task_id: task.id).destroy_all
          TaskLink.where(source_task_id: task.id, target_task_id: @task.id).destroy_all
        end
        notice = "Link(s) broken because the movement would have caused overlap."
        return { status: :ok, updates: nil, notice: notice }
      end

      unless params[:proceed_linked_overlap].to_s == 'true'
        overlap_msg = overlap_names.size == 1 ?
          "This movement will make the linked task overlap with '#{overlap_names.first}'. Proceed anyway or break the link?" :
          "This movement will make the linked task overlap with: #{overlap_names.join(', ')}. Proceed anyway or break the link?"
        return {
          status: :overlap_warning,
          message: overlap_msg,
          overlap_names: overlap_names,
          overlap_context: 'linked_shift'
        }
      end
    end

    project_start = @project.start_date
    if project_start && project_start > Date.current && params[:proceed_project_start].to_s != 'true'
      earliest = ([new_start] + proposed.map { |p| p[:start_date] }).min
      if earliest && earliest < project_start
        return { status: :project_start_warning, message: "This will move the project start date to #{earliest.strftime('%Y-%m-%d')}. Proceed?" }
      end
    end

    updates = []
    proposed.each do |entry|
      task = entry[:task]
      task.update_columns(
        start_date: entry[:start_date],
        end_date: entry[:end_date],
        updated_at: Time.current
      )
      updates << {
        id: task.id,
        start_date: entry[:start_date].strftime('%Y-%m-%d'),
        end_date: entry[:end_date].strftime('%Y-%m-%d')
      }
    end

    if project_start && project_start > Date.current && params[:proceed_project_start].to_s == 'true'
      earliest = ([new_start] + proposed.map { |p| p[:start_date] }).min
      if earliest && earliest < project_start
        @project.update_columns(start_date: earliest, updated_at: Time.current)
      end
    end

    links_to_break.each(&:destroy)
    notice = break_links_notice(links_to_break)

    { status: :ok, updates: updates.presence, notice: notice }
  end

  def collect_linked_tasks_for_shift(task)
    require 'set'
    visited = Set.new([task.id])
    queue = [task]
    tasks = []
    links_to_break = []
    today = Date.current
    project_started = @project.start_date.present? && @project.start_date <= today

    while queue.any?
      current = queue.shift
      links = TaskLink.where(source_task_id: current.id).or(TaskLink.where(target_task_id: current.id))
      links.each do |link|
        linked_id = link.source_task_id == current.id ? link.target_task_id : link.source_task_id
        next if visited.include?(linked_id)
        linked_task = Task.find_by(id: linked_id)
        next unless linked_task&.start_date && linked_task&.end_date

        if project_started && linked_task.start_date <= today
          links_to_break << link
          next
        end

        visited << linked_id
        tasks << linked_task
        queue << linked_task
      end
    end

    [tasks, links_to_break.uniq]
  end

  def overlaps_for_shift(proposed_tasks, excluded_ids)
    names = []
    proposed_tasks.each do |entry|
      task = entry[:task]
      responsible_ids = task.responsible_users.pluck(:id)
      next if responsible_ids.empty?

      overlaps = Task.joins(:responsible_assignments)
        .where(project_id: @project.id)
        .where(task_assignments: { user_id: responsible_ids, role: 'responsible' })
        .where.not(id: excluded_ids)
        .where.not(start_date: nil, end_date: nil)
        .where('start_date <= ? AND end_date >= ?', entry[:end_date], entry[:start_date])
        .distinct

      overlaps.each do |overlap|
        names << overlap.name
      end
    end
    names.uniq
  end

  def break_links_notice(links)
    return nil if links.empty?
    'Some links were broken because the linked tasks have already started.'
  end

  def linked_warning_message(context)
    if context[:warn_incoming] && context[:warn_outgoing]
      'This task is linked to another task and also has linked tasks. Align automatically or break the link(s)?'
    elsif context[:warn_incoming]
      source = @task.incoming_task_link&.source_task
      "This task is linked to '#{source&.name}'. Align it automatically or break the link?"
    else
      'One or more tasks are linked to this task. Align them automatically or break the link(s)?'
    end
  end

  def handle_link_decision(decision, context)
    updates = []
    notice = nil

    if context[:break_incoming] && @task.incoming_task_link
      source_name = @task.incoming_task_link.source_task&.name
      @task.incoming_task_link.destroy
      notice = "Link to '#{source_name}' was broken."
    end

    if context[:break_outgoing]
      TaskLink.where(source_task_id: @task.id).destroy_all
      notice = 'Linked tasks were unlinked.'
    end

    if context[:warn_incoming] && decision.present?
      incoming = @task.incoming_task_link
      if incoming && @task.start_date
        case decision
        when 'align'
          source = incoming.source_task
          if source&.start_date
            duration = (@task.end_date - @task.start_date).to_i
            new_start = source.start_date + (incoming.anchor_day - 1).days + (incoming.offset_days || 0).days
            @task.update_columns(
              start_date: new_start,
              end_date: new_start + duration.days,
              updated_at: Time.current
            )
            updates << {
              id: @task.id,
              start_date: @task.start_date.strftime('%Y-%m-%d'),
              end_date: @task.end_date.strftime('%Y-%m-%d')
            }
          end
        when 'break'
          incoming.destroy
          notice = "Link to '#{incoming.source_task&.name}' was broken."
        end
      end
    end

    if context[:warn_outgoing] && decision.present?
      links = TaskLink.includes(:target_task).where(source_task_id: @task.id)
      case decision
      when 'align'
        links.each do |link|
          target = link.target_task
          next unless target&.start_date && target&.end_date && @task.start_date

          duration = (target.end_date - target.start_date).to_i
          new_start = @task.start_date + (link.anchor_day - 1).days + (link.offset_days || 0).days
          target.update_columns(
            start_date: new_start,
            end_date: new_start + duration.days,
            updated_at: Time.current
          )
          updates << {
            id: target.id,
            start_date: target.start_date.strftime('%Y-%m-%d'),
            end_date: target.end_date.strftime('%Y-%m-%d')
          }
        end
      when 'break'
        links.destroy_all
        notice = 'Linked tasks were unlinked.'
      end
    end

    [updates.presence, notice]
  end

  def overlapping_tasks_for_responsible
    responsible_ids = case params[:field]
                      when 'responsible_user_id'
                        params[:value].present? && params[:value] != '0' ? [params[:value].to_i] : []
                      when 'date_range'
                        if params.key?(:responsible_user_id)
                          rid = params[:responsible_user_id]
                          rid.present? && rid.to_s != '0' ? [rid.to_i] : []
                        else
                          @task.responsible_users.pluck(:id)
                        end
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

  def apply_default_segment_template(task, reset: false)
    return false unless task.start_date && task.end_date
    duration = (task.end_date - task.start_date).to_i + 1
    return false if duration < 5

    if reset
      task.task_segments.delete_all
      task.task_checkpoints.delete_all
    end

    segment_days = default_template_days(duration)
    names = [
      'stage 1: rough version',
      'stage 1 retake',
      'stage 2: final version',
      'stage 2 retake',
      'buffer'
    ]
    colors = [
      '#3b82f6', # stage 1: blue
      '#f59e0b', # stage 1 retake: amber
      '#10b981', # stage 2: green
      '#f59e0b', # stage 2 retake: amber
      '#6366f1'  # buffer: indigo
    ]

    start_day = 1.0
    segment_days.each_with_index do |days, index|
      end_day = start_day + days - 1
      percent = segment_percent(start_day, end_day, duration)
      task.task_segments.create!(
        name: names[index],
        start_day: start_day,
        end_day: end_day,
        color: colors[index],
        default_percent: percent,
        percent_flagged: false
      )
      start_day = end_day + 1
    end

    # checkpoints after segment 1 and segment 3
    checkpoint_days = [segment_days[0], segment_days[0] + segment_days[1] + segment_days[2]]
    checkpoint_names = ['Check 1', 'Check 2']
    checkpoint_days.each_with_index do |day, index|
      next if day >= duration
      task.task_checkpoints.create!(day: day.to_i, name: checkpoint_names[index])
    end

    true
  end

  def default_template_days(duration)
    return [1, 1, 1, 1, 1] if duration == 5

    if duration <= 7
      base = [1, 1, 1, 1, 1]
      remaining = duration - 5
      toggle = true
      while remaining > 0
        if toggle
          base[0] += 1
        else
          base[2] += 1
        end
        toggle = !toggle
        remaining -= 1
      end
      return base
    end

    targets = [0.1, 0.1, 0.5, 0.15, 0.15].map { |pct| pct * duration }
    base = targets.map { |t| [round_to_half_day(t), 0.5].max }
    sum = base.sum
    remaining = duration - sum

    if remaining.abs > 0.001
      step = 0.5
      priority = [0, 2, 1, 3, 4]
      if remaining > 0
        i = 0
        while remaining > 0.001
          idx = priority[i % priority.length]
          base[idx] += step
          remaining -= step
          i += 1
        end
      else
        i = 0
        while remaining < -0.001 && i < priority.length * 10
          idx = priority.reverse[i % priority.length]
          if base[idx] - step >= 0.5
            base[idx] -= step
            remaining += step
          end
          i += 1
        end
      end
    end

    base
  end
end

