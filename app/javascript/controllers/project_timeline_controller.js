import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "wrapper",
    "scrollContainer",
    "contributorsColumn",
    "contributorsList",
    "timelineArea",
    "headerArea",
    "rowsArea"
  ]

  connect() {
    this.activeFilters = new Set()
    this.myFeaturesOnly = false
    
    // Get project dates
    const startDateStr = this.wrapperTarget.dataset.projectStartDate
    const endDateStr = this.wrapperTarget.dataset.projectEndDate
    this.projectStartDate = new Date(startDateStr)
    this.projectEndDate = new Date(endDateStr)
    
    // Get current user ID
    this.currentUserId = parseInt(this.wrapperTarget.dataset.currentUserId)
    
    // Calculate total days
    this.totalDays = Math.ceil((this.projectEndDate - this.projectStartDate) / (1000 * 60 * 60 * 24))
    
    // Zoom settings - represents zoom level from 0 (max zoom in) to 1 (max zoom out)
    this.minZoomLevel = 0 // Maximum zoom in: 7 days visible in timeline width
    this.maxZoomLevel = 1 // Maximum zoom out: full project visible in timeline width
    this.currentZoomLevel = 1 // Start zoomed out
    
    // Initialize empty arrays first
    this.allFeatures = []
    this.allProjectContributors = []
    
    // Store scroll handlers to prevent duplicates
    this.scrollHandlers = {
      rowsHorizontalScroll: null,
      headerScroll: null,
      rowsVerticalScroll: null,
      contributorsScroll: null
    }
    
    // Load features and contributors data
    this.loadFeatures()
    this.loadContributors()
    
    // Initialize timeline after a short delay to ensure DOM is ready
    setTimeout(() => {
      console.log('Initializing timeline with:', {
        features: this.allFeatures.length,
        contributors: this.allProjectContributors.length
      })
      this.renderTimeline()
    }, 100)
    
    // Add wheel event listener for zooming
    this.timelineAreaTarget.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false })
  }

  loadFeatures() {
    try {
      const featuresJson = this.wrapperTarget.dataset.features
      console.log('Raw features JSON:', featuresJson)
      if (featuresJson && featuresJson.trim() !== '') {
        // Try to parse - handle potential HTML entity encoding
        let jsonString = featuresJson
        // Decode HTML entities if present
        if (jsonString.includes('&quot;') || jsonString.includes('&amp;')) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = jsonString
          jsonString = tempDiv.textContent || tempDiv.innerText || jsonString
        }
        this.allFeatures = JSON.parse(jsonString)
        console.log('Loaded features:', this.allFeatures.length)
      } else {
        this.allFeatures = []
      }
    } catch (e) {
      console.error('Error loading features:', e)
      console.error('JSON string was:', this.wrapperTarget.dataset.features)
      this.allFeatures = []
    }
  }

  loadContributors() {
    try {
      const contributorsJson = this.wrapperTarget.dataset.contributors
      console.log('Raw contributors JSON:', contributorsJson)
      if (contributorsJson && contributorsJson.trim() !== '') {
        // Try to parse - handle potential HTML entity encoding
        let jsonString = contributorsJson
        // Decode HTML entities if present
        if (jsonString.includes('&quot;') || jsonString.includes('&amp;')) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = jsonString
          jsonString = tempDiv.textContent || tempDiv.innerText || jsonString
        }
        this.allProjectContributors = JSON.parse(jsonString)
        console.log('Loaded project contributors:', this.allProjectContributors.length, this.allProjectContributors)
      } else {
        console.warn('No contributors JSON found in data attribute')
        this.allProjectContributors = []
      }
    } catch (e) {
      console.error('Error loading contributors:', e)
      console.error('JSON string was:', this.wrapperTarget.dataset.contributors)
      this.allProjectContributors = []
    }
  }

  toggleStatusFilter(event) {
    const button = event.currentTarget
    const status = button.dataset.status
    
    if (button.classList.contains('active')) {
      button.classList.remove('active')
      this.activeFilters.delete(status)
    } else {
      button.classList.add('active')
      this.activeFilters.add(status)
    }
    
    this.applyFilters()
  }

  toggleMyFeaturesFilter(event) {
    const button = event.currentTarget
    this.myFeaturesOnly = !this.myFeaturesOnly
    
    if (this.myFeaturesOnly) {
      button.classList.add('active')
    } else {
      button.classList.remove('active')
    }
    
    this.applyFilters()
  }

  applyFilters() {
    this.renderTimeline()
  }

  handleWheel(event) {
    // Zoom with wheel scroll (no need for Ctrl/Cmd)
    event.preventDefault()
    
    // Zoom increment per scroll step
    const zoomStep = 0.05
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep
    let newZoomLevel = this.currentZoomLevel + delta
    
    // Clamp zoom between min and max
    newZoomLevel = Math.max(this.minZoomLevel, Math.min(this.maxZoomLevel, newZoomLevel))
    
    if (Math.abs(newZoomLevel - this.currentZoomLevel) > 0.01) {
      this.currentZoomLevel = newZoomLevel
      this.renderTimeline()
    }
  }

  renderTimeline() {
    // Get filtered features
    const filteredFeatures = this.getFilteredFeatures()
    console.log('Filtered features:', filteredFeatures.length)
    
    // Get unique contributors - use all project contributors regardless of features
    const contributors = this.getContributors(filteredFeatures)
    console.log('Contributors found:', contributors.length, contributors)
    console.log('All project contributors:', this.allProjectContributors)
    
    // Render contributors column
    this.renderContributors(contributors)
    
    // Render timeline
    this.renderTimelineGrid(contributors, filteredFeatures)
    
    // Sync scroll positions after rendering
    setTimeout(() => {
      this.syncScrollPositions()
    }, 100)
  }

  getFilteredFeatures() {
    let features = [...this.allFeatures]
    
    // Apply status filters
    if (this.activeFilters.size > 0) {
      features = features.filter(f => this.activeFilters.has(f.status))
    }
    
    // Apply my features filter
    if (this.myFeaturesOnly) {
      features = features.filter(f => {
        const isResponsible = f.responsible_contributors?.some(c => c.id === this.currentUserId)
        const isAccountable = f.accountable_contributors?.some(c => c.id === this.currentUserId)
        return isResponsible || isAccountable
      })
    }
    
    return features
  }

  getContributors(features) {
    // Start with all project contributors
    const contributorMap = new Map()
    
    console.log('getContributors called with:', {
      allProjectContributors: this.allProjectContributors,
      featuresCount: features.length
    })
    
    // Add all project contributors first
    if (this.allProjectContributors && Array.isArray(this.allProjectContributors)) {
      this.allProjectContributors.forEach(contributor => {
        if (contributor && contributor.id) {
          contributorMap.set(contributor.id, contributor)
        }
      })
    }
    
    // Also add any contributors from features (in case some aren't in project contributors)
    features.forEach(feature => {
      if (feature.responsible_contributors && Array.isArray(feature.responsible_contributors)) {
        feature.responsible_contributors.forEach(contributor => {
          if (contributor && contributor.id) {
            if (!contributorMap.has(contributor.id)) {
              contributorMap.set(contributor.id, contributor)
            }
          }
        })
      }
      if (feature.accountable_contributors && Array.isArray(feature.accountable_contributors)) {
        feature.accountable_contributors.forEach(contributor => {
          if (contributor && contributor.id) {
            if (!contributorMap.has(contributor.id)) {
              contributorMap.set(contributor.id, contributor)
            }
          }
        })
      }
    })
    
    const contributors = Array.from(contributorMap.values())
    console.log('Final contributors list:', contributors)
    return contributors.sort((a, b) => {
      const nameA = a.name || ''
      const nameB = b.name || ''
      return nameA.localeCompare(nameB)
    })
  }

  renderContributors(contributors) {
    const list = this.contributorsListTarget
    if (!list) {
      console.error('Contributors list target not found!')
      return
    }
    
    list.innerHTML = ''
    
    console.log('Rendering contributors:', contributors.length, contributors)
    
    if (contributors.length === 0) {
      const emptyDiv = document.createElement('div')
      emptyDiv.className = 'timeline-contributor-item'
      emptyDiv.textContent = 'No contributors'
      emptyDiv.style.color = 'rgba(255, 255, 255, 0.5)'
      list.appendChild(emptyDiv)
      return
    }
    
    contributors.forEach(contributor => {
      const div = document.createElement('div')
      div.className = 'timeline-contributor-item'
      div.textContent = contributor.name || 'Unknown'
      div.dataset.contributorId = contributor.id
      list.appendChild(div)
    })
  }

  renderTimelineGrid(contributors, features) {
    // Always render the FULL project timeline (from start to end)
    const visibleStartDate = new Date(this.projectStartDate)
    const visibleEndDate = new Date(this.projectEndDate)
    
    // Get the actual timeline width (excluding contributors column)
    // Use getBoundingClientRect for more accurate width calculation
    const timelineRect = this.timelineAreaTarget.getBoundingClientRect()
    const timelineWidth = timelineRect.width || this.timelineAreaTarget.offsetWidth || 800
    
    // Calculate pixels per day based on zoom level
    // At zoom level 1 (max zoom out): totalDays fit in timelineWidth (no horizontal scroll)
    // At zoom level 0 (max zoom in): 7 days fit in timelineWidth (horizontal scroll enabled)
    // Interpolate between these two
    const maxZoomOutPixelsPerDay = timelineWidth / this.totalDays
    const maxZoomInPixelsPerDay = timelineWidth / 7
    
    // Interpolate based on currentZoomLevel (0 = zoomed in, 1 = zoomed out)
    const pixelsPerDay = maxZoomInPixelsPerDay + (maxZoomOutPixelsPerDay - maxZoomInPixelsPerDay) * this.currentZoomLevel
    
    // Render header for full timeline
    this.renderTimelineHeader(visibleStartDate, visibleEndDate, pixelsPerDay)
    
    // Render rows for full timeline
    this.renderTimelineRows(contributors, features, visibleStartDate, visibleEndDate, pixelsPerDay)
  }

  renderTimelineHeader(startDate, endDate, pixelsPerDay) {
    const header = this.headerAreaTarget
    header.innerHTML = ''
    
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    
    // Get timeline width for calculating visible days
    const timelineRect = this.timelineAreaTarget.getBoundingClientRect()
    const timelineWidth = timelineRect.width || this.timelineAreaTarget.offsetWidth || 800
    
    // Calculate how many days fit in the viewport at current zoom
    const visibleDays = timelineWidth / pixelsPerDay
    
    // Determine header type based on visibleDays (how many days fit in viewport)
    // More visible days = more zoomed out (show months/years)
    // Fewer visible days = more zoomed in (show days)
    let headerType = 'day'
    let cellWidth = pixelsPerDay
    let cellCount = days
    
    if (visibleDays > 730) {
      // Very zoomed out - can see more than 2 years, show years
      headerType = 'year'
      const startYear = startDate.getFullYear()
      const endYear = endDate.getFullYear()
      cellCount = endYear - startYear + 1
      cellWidth = (days * pixelsPerDay) / cellCount
    } else if (visibleDays > 60) {
      // Zoomed out - can see more than 2 months, show months
      headerType = 'month'
      let currentDate = new Date(startDate)
      currentDate.setDate(1) // Start of month
      const endMonthDate = new Date(endDate)
      endMonthDate.setDate(1)
      cellCount = 0
      const tempDate = new Date(currentDate)
      while (tempDate <= endMonthDate) {
        cellCount++
        tempDate.setMonth(tempDate.getMonth() + 1)
      }
      cellWidth = (days * pixelsPerDay) / cellCount
    } else if (visibleDays > 7) {
      // Medium zoom - can see more than a week, show weeks
      headerType = 'week'
      cellCount = Math.ceil(days / 7)
      cellWidth = pixelsPerDay * 7
    } else {
      // Zoomed in - can see a week or less, show days
      headerType = 'day'
      cellWidth = pixelsPerDay
      cellCount = days
    }
    
    // Always use the full timeline width to match rows area exactly
    const totalWidth = Math.ceil(days * pixelsPerDay) // Ensure integer pixel width
    header.style.width = `${totalWidth}px`
    header.style.minWidth = `${totalWidth}px`
    
    // Render headers based on type
    if (headerType === 'year') {
      let currentDate = new Date(startDate)
      for (let i = 0; i < cellCount; i++) {
        const year = currentDate.getFullYear()
        const yearCell = document.createElement('div')
        yearCell.className = 'timeline-day-header'
        yearCell.style.width = `${cellWidth}px`
        yearCell.textContent = year
        yearCell.title = year.toString()
        header.appendChild(yearCell)
        currentDate.setFullYear(currentDate.getFullYear() + 1)
      }
    } else if (headerType === 'month') {
      let currentDate = new Date(startDate)
      for (let i = 0; i < cellCount; i++) {
        const monthCell = document.createElement('div')
        monthCell.className = 'timeline-day-header timeline-month-header'
        monthCell.style.width = `${cellWidth}px`
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase()
        const year = currentDate.getFullYear()
        monthCell.textContent = `${monthName} ${year}`
        monthCell.title = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        header.appendChild(monthCell)
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    } else if (headerType === 'week') {
      let currentDate = new Date(startDate)
      // Start from the beginning of the week
      const dayOfWeek = currentDate.getDay()
      currentDate.setDate(currentDate.getDate() - dayOfWeek)
      
      for (let i = 0; i < cellCount; i++) {
        const weekCell = document.createElement('div')
        weekCell.className = 'timeline-day-header'
        weekCell.style.width = `${cellWidth}px`
        const weekEnd = new Date(currentDate)
        weekEnd.setDate(weekEnd.getDate() + 6)
        // Use project week number (relative to project start) instead of calendar week
        const projectWeek = this.getProjectWeekNumber(currentDate)
        weekCell.textContent = `W${projectWeek}`
        weekCell.title = `${currentDate.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
        header.appendChild(weekCell)
        currentDate.setDate(currentDate.getDate() + 7)
        if (currentDate > endDate) break
      }
    } else {
      // Days
      const currentDate = new Date(startDate)
      let dayCount = 0
      while (currentDate <= endDate && dayCount < days) {
        const dayCell = document.createElement('div')
        dayCell.className = 'timeline-day-header timeline-day-full-header'
        dayCell.style.width = `${cellWidth}px`
        // Format as DD/MM/YYYY
        const day = String(currentDate.getDate()).padStart(2, '0')
        const month = String(currentDate.getMonth() + 1).padStart(2, '0')
        const year = currentDate.getFullYear()
        dayCell.textContent = `${day}/${month}/${year}`
        dayCell.title = currentDate.toLocaleDateString()
        dayCell.dataset.date = currentDate.toISOString().split('T')[0]
        header.appendChild(dayCell)
        
        currentDate.setDate(currentDate.getDate() + 1)
        dayCount++
      }
    }
  }

  getWeekNumber(date) {
    // Calculate calendar week number (for reference, but we'll use project week instead)
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  getProjectWeekNumber(date) {
    // Calculate week number relative to project start date (W1 is the first week of the project)
    const projectStart = new Date(this.projectStartDate)
    
    // Get the start of the week for the project start date
    const projectStartDay = projectStart.getDay()
    const projectWeekStart = new Date(projectStart)
    projectWeekStart.setDate(projectWeekStart.getDate() - projectStartDay)
    
    // Get the start of the week for the given date
    const dateDay = date.getDay()
    const dateWeekStart = new Date(date)
    dateWeekStart.setDate(dateWeekStart.getDate() - dateDay)
    
    // Calculate the difference in days
    const daysDifference = Math.floor((dateWeekStart - projectWeekStart) / (1000 * 60 * 60 * 24))
    
    // Calculate week number (add 1 to start from W1)
    const weekNumber = Math.floor(daysDifference / 7) + 1
    
    return Math.max(1, weekNumber) // Ensure it's at least 1
  }

  renderTimelineRows(contributors, features, startDate, endDate, pixelsPerDay) {
    const rowsArea = this.rowsAreaTarget
    rowsArea.innerHTML = ''
    
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    const totalWidth = Math.ceil(days * pixelsPerDay) // Ensure integer pixel width
    
    // Don't set width on rowsArea itself - it should be constrained by parent
    // Instead, each row inside will have the full width, making rowsArea scrollable
    rowsArea.style.width = 'auto'
    rowsArea.style.minWidth = 'auto'
    
    if (contributors.length === 0) {
      // If no contributors, show a message or create rows for all features
      console.log('No contributors found, checking features:', features.length)
    }
    
    contributors.forEach(contributor => {
      const row = document.createElement('div')
      row.className = 'timeline-row'
      row.dataset.contributorId = contributor.id
      
      // Set row width to match timeline width so it extends beyond viewport
      row.style.width = `${totalWidth}px`
      row.style.minWidth = `${totalWidth}px`
      
      // Find features for this contributor
      const contributorFeatures = features.filter(f => {
        if (!f.start_date || !f.end_date) return false
        const isResponsible = f.responsible_contributors?.some(c => c.id === contributor.id)
        const isAccountable = f.accountable_contributors?.some(c => c.id === contributor.id)
        return isResponsible || isAccountable
      })
      
      // Render feature bars
      contributorFeatures.forEach(feature => {
        const featureBar = this.createFeatureBar(feature, startDate, pixelsPerDay)
        row.appendChild(featureBar)
      })
      
      rowsArea.appendChild(row)
    })
  }

  createFeatureBar(feature, startDate, pixelsPerDay) {
    const bar = document.createElement('div')
    bar.className = `timeline-feature-bar status-${feature.status || 'not_started'}`
    
    const featureStart = new Date(feature.start_date)
    const featureEnd = new Date(feature.end_date)
    
    // Calculate position relative to startDate
    const daysFromStart = (featureStart - startDate) / (1000 * 60 * 60 * 24)
    const featureDuration = (featureEnd - featureStart) / (1000 * 60 * 60 * 24)
    
    const left = Math.max(0, daysFromStart * pixelsPerDay)
    const width = Math.max(10, featureDuration * pixelsPerDay) // Minimum 10px width
    
    bar.style.left = `${left}px`
    bar.style.width = `${width}px`
    bar.textContent = feature.name
    bar.title = `${feature.name} (${featureStart.toLocaleDateString()} - ${featureEnd.toLocaleDateString()})`
    
    // Make bar clickable
    bar.style.cursor = 'pointer'
    bar.addEventListener('click', (e) => {
      e.stopPropagation()
      // Get project ID from URL or try to extract from path
      const pathMatch = window.location.pathname.match(/\/projects\/(\d+)/)
      if (pathMatch) {
        window.location.href = `/projects/${pathMatch[1]}/project_features/${feature.id}`
      }
    })
    
    return bar
  }

  syncScrollPositions() {
    // Remove old listeners if they exist
    const headerArea = this.headerAreaTarget
    const rowsArea = this.rowsAreaTarget
    const contributorsList = this.contributorsListTarget
    
    if (this.scrollHandlers.rowsHorizontalScroll && rowsArea) {
      rowsArea.removeEventListener('scroll', this.scrollHandlers.rowsHorizontalScroll)
    }
    if (this.scrollHandlers.headerScroll && headerArea) {
      headerArea.removeEventListener('scroll', this.scrollHandlers.headerScroll)
    }
    if (this.scrollHandlers.rowsVerticalScroll && rowsArea) {
      rowsArea.removeEventListener('scroll', this.scrollHandlers.rowsVerticalScroll)
    }
    if (this.scrollHandlers.contributorsScroll && contributorsList) {
      contributorsList.removeEventListener('scroll', this.scrollHandlers.contributorsScroll)
    }
    
    // Create new handlers
    if (headerArea && rowsArea) {
      // Sync horizontal scroll between header and rows
      this.scrollHandlers.rowsHorizontalScroll = () => {
        headerArea.scrollLeft = rowsArea.scrollLeft
      }
      this.scrollHandlers.headerScroll = () => {
        rowsArea.scrollLeft = headerArea.scrollLeft
      }
      
      // Sync contributors list scroll with rows scroll (vertical)
      if (contributorsList) {
        this.scrollHandlers.rowsVerticalScroll = () => {
          contributorsList.scrollTop = rowsArea.scrollTop
        }
        this.scrollHandlers.contributorsScroll = () => {
          rowsArea.scrollTop = contributorsList.scrollTop
        }
      }
      
      // Combine handlers for rows area (both horizontal and vertical)
      const rowsScrollHandler = () => {
        this.scrollHandlers.rowsHorizontalScroll()
        if (contributorsList && this.scrollHandlers.rowsVerticalScroll) {
          this.scrollHandlers.rowsVerticalScroll()
        }
      }
      
      rowsArea.addEventListener('scroll', rowsScrollHandler)
      headerArea.addEventListener('scroll', this.scrollHandlers.headerScroll)
      
      if (contributorsList) {
        contributorsList.addEventListener('scroll', this.scrollHandlers.contributorsScroll)
      }
    }
  }
}
