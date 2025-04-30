module ProjectsHelper
  def status_badge_class(status)
    case status
    when 'not_started' then 'bg-warning text-dark'
    when 'work_in_progress' then 'bg-primary text-white'
    when 'job_done' then 'bg-success text-white'
    else 'bg-secondary text-white'
    end
  end
end
