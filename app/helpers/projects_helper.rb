module ProjectsHelper
  def status_badge_class(status)
    case status
    when 'not_started' then 'bg-warning text-dark'
    when 'work_in_progress' then 'bg-primary text-white'
    when 'job_done' then 'bg-success text-white'
    else 'bg-secondary text-white'
    end
  end

  def calculate_required_rows(features, start_date, end_date)
    return 1 if features.empty?
    
    rows = []
    features.sort_by { |f| f.start_date || start_date }.each do |feature|
      feature_start = feature.start_date || start_date
      feature_end = feature.end_date || end_date
      
      # Find first row where feature fits
      row_index = rows.find_index do |row|
        row.none? do |existing|
          existing_start = existing.start_date || start_date
          existing_end = existing.end_date || end_date
          (feature_start <= existing_end) && (feature_end >= existing_start)
        end
      end
      
      if row_index.nil?
        rows << [feature]
      else
        rows[row_index] << feature
      end
    end
    
    rows.length
  end
end
