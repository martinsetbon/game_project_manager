module ApplicationHelper
  def get_feature_status_text(feature)
    case feature.status
    when 'work_in_progress'
      if feature.start_date && feature.end_date
        total_days = (feature.end_date - feature.start_date).to_i
        current_day = (Date.current - feature.start_date).to_i
        percentage = [(current_day.to_f / total_days * 100).round, 100].min
        "#{percentage}% done"
      else
        "ongoing"
      end
    when 'not_started'
      if feature.start_date
        days_until_start = (feature.start_date - Date.current).to_i
        if days_until_start == 0
          "start today"
        elsif days_until_start == 1
          "start tomorrow"
        else
          "start in #{days_until_start} days"
        end
      else
        "not started"
      end
    when 'stand_by'
      "stand by"
    when 'job_done'
      "job done"
    else
      feature.status.humanize
    end
  end

  # Generate a consistent color for a feature based on its ID
  # Uses a color palette that cycles through different colors
  def feature_text_color(feature_id)
    return '#FFFFFF' if feature_id.nil? || feature_id == 'none'
    
    # Color palette - distinct colors that work well on dark backgrounds
    colors = [
      '#FF6B6B', # Red
      '#4ECDC4', # Teal
      '#45B7D1', # Blue
      '#FFA07A', # Light Salmon
      '#98D8C8', # Mint
      '#F7DC6F', # Yellow
      '#BB8FCE', # Purple
      '#85C1E2', # Sky Blue
      '#F8B739', # Orange
      '#52BE80', # Green
      '#EC7063', # Coral
      '#5DADE2', # Light Blue
      '#F1948A', # Pink
      '#73C6B6', # Turquoise
      '#F4D03F', # Gold
      '#AF7AC5', # Lavender
      '#76D7C4', # Aqua
      '#F5B041', # Amber
      '#85C1E9', # Light Blue
      '#82E0AA'  # Light Green
    ]
    
    colors[feature_id.to_i % colors.length]
  end
end
