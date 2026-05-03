# frozen_string_literal: true

# Builds a project feature and child tasks from form rows or a feature template + anchor date.
# Detects time overlaps among new tasks (same responsible) and against existing scheduled tasks.
class ProjectFeatureBulkCreator
  attr_reader :project, :creator, :feature_name, :task_rows, :template, :anchor_date, :from_template_only

  def initialize(project:, creator:, feature_name:, task_rows: [], template: nil, anchor_date: nil, from_template_only: false)
    @project = project
    @creator = creator
    @feature_name = feature_name.to_s.strip
    @task_rows = Array(task_rows)
    @template = template
    @anchor_date = anchor_date
    @from_template_only = from_template_only
  end

  def planned_tasks
    @planned_tasks ||= build_planned_tasks
  end

  def validation_errors
    planned_tasks
    @validation_errors || []
  end

  def overlap_messages
    @overlap_messages ||= collect_overlap_messages(planned_tasks)
  end

  def create!(proceed_overlaps: false)
    return { status: :error, errors: ['Feature name is required'] } if @feature_name.blank?
    return { status: :error, errors: ['No tasks to create'] } if planned_tasks.empty?
    return { status: :error, errors: validation_errors } if validation_errors.any?

    unless proceed_overlaps
      msgs = overlap_messages
      return { status: :overlap, overlaps: msgs } if msgs.any?
    end

    feature_start, feature_end = feature_date_span(planned_tasks)
    feature = nil
    created_tasks = []

    ActiveRecord::Base.transaction do
      feature = @project.project_features.create!(
        name: @feature_name,
        start_date: feature_start || Date.current,
        end_date: feature_end || feature_start || Date.current,
        status: 'not_started'
      )

      planned_tasks.each_with_index do |row, order|
        task = create_one_task(feature, row, order)
        created_tasks << task
      end

      # Tighten feature bounds to dated children only
      dated = created_tasks.select { |t| t.start_date.present? && t.end_date.present? }
      if dated.any?
        fs = dated.map(&:start_date).min
        fe = dated.map(&:end_date).max
        feature.update_columns(start_date: fs, end_date: fe, updated_at: Time.current)
      end
    end

    { status: :success, feature: feature, tasks: created_tasks }
  rescue ActiveRecord::RecordInvalid => e
    { status: :error, errors: e.record.errors.full_messages.presence || [e.message] }
  end

  # Adds tasks to an existing feature (same row shape as #create!). Expands feature start/end to include new dated tasks.
  def append_to_feature!(feature, proceed_overlaps: false)
    return { status: :error, errors: ['No tasks to create'] } if planned_tasks.empty?
    return { status: :error, errors: validation_errors } if validation_errors.any?

    unless proceed_overlaps
      msgs = overlap_messages
      return { status: :overlap, overlaps: msgs } if msgs.any?
    end

    created_tasks = []
    ActiveRecord::Base.transaction do
      start_order = feature.tasks.top_level.maximum(:order)
      start_order = start_order.nil? ? 0 : start_order + 1

      planned_tasks.each_with_index do |row, i|
        task = create_one_task(feature, row, start_order + i)
        created_tasks << task
      end

      dated = feature.tasks.reload.select { |t| t.start_date.present? && t.end_date.present? }
      if dated.any?
        fs = dated.map(&:start_date).min
        fe = dated.map(&:end_date).max
        feature.update_columns(start_date: fs, end_date: fe, updated_at: Time.current)
      end
    end

    { status: :success, feature: feature.reload, tasks: created_tasks }
  rescue ActiveRecord::RecordInvalid => e
    { status: :error, errors: e.record.errors.full_messages.presence || [e.message] }
  end

  def self.merge_tasks_from_template_rows(template, anchor_date)
    return [] unless template && anchor_date

    rows = []
    d = anchor_date
    (template.tasks_data || []).each do |td|
      name = td['name'] || td[:name]
      dur = (td['duration'] || td[:duration]).to_i
      next if name.blank? || dur < 1

      end_d = d + (dur - 1).days
      rows << { 'name' => name, 'start_date' => d.strftime('%Y-%m-%d'), 'end_date' => end_d.strftime('%Y-%m-%d'), 'responsible_user_id' => '' }
      d = end_d + 1.day
    end
    rows
  end

  private

  def build_planned_tasks
    rows = if @from_template_only && @template.present? && @anchor_date.present?
             self.class.merge_tasks_from_template_rows(@template, @anchor_date).map { |r| normalize_row(r) }
           else
             @task_rows.map { |r| normalize_row(r) }.select { |r| r[:name].present? }
           end

    @validation_errors = collect_validation_errors(rows)
    return rows if @validation_errors.any?

    schedule_rows(rows)
  end

  def normalize_row(r)
    r = r.stringify_keys if r.respond_to?(:stringify_keys)
    name = (r['name'] || r[:name]).to_s.strip
    sd = parse_date(r['start_date'] || r[:start_date])
    ed = parse_date(r['end_date'] || r[:end_date])
    rid = r['responsible_user_id'] || r[:responsible_user_id]
    uid = rid.present? && rid.to_s != '0' ? rid.to_i : nil
    { name: name, start_date: sd, end_date: ed, responsible_user_id: uid }
  end

  def parse_date(v)
    return nil if v.blank?

    Date.parse(v.to_s)
  rescue ArgumentError
    nil
  end

  def collect_validation_errors(rows)
    errors = []
    return errors if rows.empty?

    errors << 'The first task must have a start date because it becomes the feature start date.' if rows.first[:start_date].blank?

    rows.each do |row|
      errors << %(Task "#{row[:name]}" must have a start date when it is assigned to a responsible user.) if row[:responsible_user_id].present? && row[:start_date].blank?
      errors << %(Task "#{row[:name]}" cannot end before it starts.) if row[:start_date].present? && row[:end_date].present? && row[:end_date] < row[:start_date]
    end

    errors.uniq
  end

  def schedule_rows(rows)
    next_start = rows.first&.fetch(:start_date, nil)

    rows.map do |row|
      start_date = row[:start_date] || next_start
      end_date = planned_end_date(row, start_date)
      next_start = end_date + 1.day

      row.merge(start_date: start_date, end_date: end_date)
    end
  end

  def planned_end_date(row, start_date)
    return start_date unless start_date

    if row[:start_date].present? && row[:end_date].present?
      row[:end_date]
    else
      start_date
    end
  end

  def collect_overlap_messages(planned)
    msgs = []

    by_user = Hash.new { |h, k| h[k] = [] }
    planned.each_with_index do |t, i|
      next if t[:start_date].nil? || t[:end_date].nil?

      by_user[t[:responsible_user_id] || :unassigned] << t.merge(index: i)
    end

    by_user.each do |lane, list|
      list.combination(2) do |a, b|
        msgs << overlap_line(a, b, lane) if range_overlap?(a, b)
      end
    end

    planned.each do |t|
      next if t[:start_date].nil? || t[:end_date].nil?

      overlapping_existing_tasks(t).find_each do |ex|
        msgs << %(New task "#{t[:name]}" overlaps existing "#{ex.name}" (#{lane_label(t[:responsible_user_id] || :unassigned)}).)
      end
    end

    msgs.uniq
  end

  def range_overlap?(a, b)
    a[:start_date] <= b[:end_date] && a[:end_date] >= b[:start_date]
  end

  def overlap_line(a, b, uid)
    %(Tasks "#{a[:name]}" and "#{b[:name]}" overlap on #{lane_label(uid)}.)
  end

  def lane_label(uid)
    return 'the unassigned row' if uid == :unassigned

    "the row for #{User.find_by(id: uid)&.name || "user ##{uid}"}"
  end

  def overlapping_existing_tasks(row)
    scope = Task.where(project_id: @project.id)
                .where.not(start_date: nil, end_date: nil)
                .where('start_date <= ? AND end_date >= ?', row[:end_date], row[:start_date])

    if row[:responsible_user_id].present?
      scope.joins(:responsible_assignments)
           .where(task_assignments: { user_id: row[:responsible_user_id], role: 'responsible' })
    else
      scope.left_joins(:responsible_assignments)
           .where(task_assignments: { id: nil })
    end
  end

  def feature_date_span(planned)
    dated = planned.select { |t| t[:start_date] && t[:end_date] }
    return [nil, nil] if dated.empty?

    [dated.map { |t| t[:start_date] }.min, dated.map { |t| t[:end_date] }.max]
  end

  def create_one_task(feature, row, order)
    base = {
      project_id: @project.id,
      project_feature_id: feature.id,
      name: row[:name],
      status: 'not_started',
      order: order
    }

    if row[:start_date].present? && row[:end_date].present?
      dur = (row[:end_date] - row[:start_date]).to_i + 1
      task = Task.create!(
        base.merge(
          start_date: row[:start_date],
          end_date: row[:end_date],
          duration: dur,
          backlog_type: nil
        )
      )
    else
      task = Task.create!(
        base.merge(
          start_date: nil,
          end_date: nil,
          duration: nil,
          backlog_type: 'project'
        )
      )
    end

    if row[:responsible_user_id].present?
      task.task_assignments.create!(user_id: row[:responsible_user_id], role: 'responsible')
    end

    task
  end
end
