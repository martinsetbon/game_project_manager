import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid", "timeHeader", "department", "timeHeaders"]

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

    // Find all department rows and set their width
    this.element.querySelectorAll('.department-row').forEach(row => {
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
    const baseWidth = 60 // Base width for day view
    const zoomScales = {
      day: 1,
      month: 3,
      year: 5
    }

    this.element.querySelectorAll('.feature-bar').forEach(feature => {
      const originalLeft = parseInt(feature.dataset.originalLeft)
      const duration = parseInt(feature.dataset.duration)
      const scale = zoomScales[zoomLevel]
      
      // Calculate new dimensions based on zoom level
      const newLeft = (originalLeft / baseWidth) * (baseWidth * scale)
      const newWidth = Math.max(duration * (baseWidth / scale), baseWidth)
      
      // Apply new dimensions with transition
      feature.style.left = `${newLeft}px`
      feature.style.width = `${newWidth}px`
    })
  }

  toggleSection(event) {
    const button = event.currentTarget
    const department = button.dataset.department
    
    // Toggle the department label
    const label = this.element.querySelector(`.department-label[data-department="${department}"]`)
    label.classList.toggle('folded')
    
    // Toggle the department row
    const row = this.element.querySelector(`.department-row[data-department="${department}"]`)
    row.classList.toggle('folded')
    
    // Toggle the button icon
    button.classList.toggle('collapsed')
  }
} 