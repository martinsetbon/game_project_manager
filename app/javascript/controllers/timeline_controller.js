import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid", "timeHeader", "contributor", "timeHeaders"]

  connect() {
    this.setDefaultZoom()
    this.updateTimelineWidth('day') // Set initial width
  }

  setDefaultZoom() {
    this.element.querySelector('[data-zoom="day"]').classList.add('active')
    this.gridTarget.classList.add('zoom-day')
  }

  zoom(event) {
    const zoomLevel = event.currentTarget.dataset.zoom
    console.log('Zoom level set to:', zoomLevel);
    
    // Remove all zoom classes and active states
    this.element.querySelectorAll('[data-zoom]').forEach(btn => btn.classList.remove('active'))
    this.gridTarget.classList.remove('zoom-day', 'zoom-month', 'zoom-year')
    
    // Add new zoom class and active state
    event.currentTarget.classList.add('active')
    this.gridTarget.classList.add(`zoom-${zoomLevel}`)
    
    // Adjust headers and features based on zoom level
    this.adjustTimeHeaders(zoomLevel)
    this.adjustFeaturePositions(zoomLevel)
    this.updateTimelineWidth(zoomLevel)
  }

  updateTimelineWidth(zoomLevel) {
    const headerWidth = {
      day: 60,
      month: 180,
      year: 300
    }[zoomLevel]

    // Get the total number of visible headers
    const visibleHeaders = this.getVisibleHeaderCount(zoomLevel)

    // Calculate total width needed
    const totalWidth = visibleHeaders * headerWidth

    // Set the width on the time headers container
    this.timeHeadersTarget.style.width = `${totalWidth}px`

    // Find all contributor rows and set their width
    this.element.querySelectorAll('.contributor-row').forEach(row => {
      row.style.width = `${totalWidth}px`
    })
  }

  getVisibleHeaderCount(zoomLevel) {
    switch (zoomLevel) {
      case 'day':
        return this.timeHeaderTargets.length
      case 'month':
        return this.timeHeaderTargets.filter(h => h.dataset.isMonthStart === 'true').length
      case 'year':
        return this.timeHeaderTargets.filter(h => h.dataset.isYearStart === 'true').length
      default:
        return this.timeHeaderTargets.length
    }
  }

  adjustTimeHeaders(zoomLevel) {
    console.log('Adjusting time headers for zoom level:', zoomLevel);
    const headers = this.timeHeaderTargets
    const headerWidth = {
      day: 60,
      month: 180,
      year: 300
    }[zoomLevel]

    headers.forEach(header => {
      const dayLabel = header.querySelector('.day-label')
      const monthLabel = header.querySelector('.month-label')
      const yearLabel = header.querySelector('.year-label')
      const isMonthStart = header.dataset.isMonthStart === 'true'
      const isYearStart = header.dataset.isYearStart === 'true'

      console.log('Header:', header.dataset.date, 'isYearStart:', isYearStart);

      // Reset visibility and width
      header.style.flex = `0 0 ${headerWidth}px`
      header.style.display = 'flex'

      // Handle visibility based on zoom level
      switch (zoomLevel) {
        case 'day':
          dayLabel.style.display = 'block'
          monthLabel.style.display = 'none'
          yearLabel.style.display = 'none'
          break
        case 'month':
          dayLabel.style.display = 'none'
          monthLabel.style.display = isMonthStart ? 'block' : 'none'
          yearLabel.style.display = 'none'
          header.style.display = isMonthStart ? 'flex' : 'none'
          break
        case 'year':
          dayLabel.style.display = 'none'
          monthLabel.style.display = 'none'
          yearLabel.style.display = isYearStart ? 'block' : 'none'
          header.style.display = isYearStart ? 'flex' : 'none'
          break
      }
    })
  }

  adjustFeaturePositions(zoomLevel) {
    console.log('Adjusting feature positions for zoom level:', zoomLevel);
    const baseWidth = 60 // Base width for day view
    const headerWidths = {
      day: 60,
      month: 180,
      year: 300
    }

    // Build an array of header dates for the current zoom level
    let headerDates = [];
    this.timeHeaderTargets.forEach(header => {
      if (zoomLevel === 'day' ||
          (zoomLevel === 'month' && header.dataset.isMonthStart === 'true') ||
          (zoomLevel === 'year' && header.dataset.isYearStart === 'true')) {
        headerDates.push(new Date(header.dataset.date));
      }
    });

    this.element.querySelectorAll('.feature-bar').forEach(feature => {
      const featureStart = new Date(feature.dataset.startDate);
      const duration = parseInt(feature.dataset.duration);
      let leftIndex = 0;

      // Find the index of the header that matches the feature's start date (or the closest one before it)
      for (let i = 0; i < headerDates.length; i++) {
        if (featureStart >= headerDates[i]) {
          leftIndex = i;
        } else {
          break;
        }
      }

      // Calculate new left and width
      const newLeft = leftIndex * headerWidths[zoomLevel];
      let newWidth = headerWidths[zoomLevel];
      if (zoomLevel === 'day') {
        newWidth = Math.max(duration * headerWidths[zoomLevel], headerWidths[zoomLevel]);
      }
      // In month/year view, keep width to one header for now (could be improved to span multiple months/years)

      // Apply new dimensions with transition
      feature.style.left = `${newLeft}px`;
      feature.style.width = `${newWidth}px`;
      
      // Log the applied styles
      console.log('Feature:', feature.dataset.id, 'newLeft:', newLeft, 'newWidth:', newWidth);
      console.log('Applied styles:', feature.style.left, feature.style.width);
    });
  }
} 