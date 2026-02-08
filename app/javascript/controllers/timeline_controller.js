import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["content", "yearView", "monthView", "periodTitle", "zoomIndicator"]
  static values = { 
    projectId: Number,
    currentYear: Number,
    currentMonth: Number
  }

  connect() {
    this.currentView = 'year'
    this.currentYear = this.currentYearValue
    this.currentMonth = this.currentMonthValue
    this.setupEventListeners()
  }

  setupEventListeners() {
    // Prevent default drag behavior on images
    document.addEventListener('dragstart', (e) => {
      if (e.target.tagName === 'IMG') {
        e.preventDefault()
      }
    })
  }

  // Navigation Methods
  previousYear() {
    this.currentYear--
    this.updatePeriodTitle()
    this.loadYearFeatures()
  }

  nextYear() {
    this.currentYear++
    this.updatePeriodTitle()
    this.loadYearFeatures()
  }

  zoomToMonth(event) {
    const month = parseInt(event.currentTarget.dataset.monthNumber)
    this.currentMonth = month
    this.currentView = 'month'
    this.showMonthView()
    this.loadMonthFeatures()
  }

  zoomToYear() {
    this.currentView = 'year'
    this.showYearView()
    this.loadYearFeatures()
  }

  // View Management
  showYearView() {
    this.yearViewTarget.classList.remove('d-none')
    this.monthViewTarget.classList.add('d-none')
    this.updatePeriodTitle()
    this.updateZoomIndicator()
  }

  showMonthView() {
    this.yearViewTarget.classList.add('d-none')
    this.monthViewTarget.classList.remove('d-none')
    this.updatePeriodTitle()
    this.updateZoomIndicator()
  }

  updatePeriodTitle() {
    if (this.currentView === 'year') {
      this.periodTitleTarget.textContent = this.currentYear
    } else {
      const monthName = new Date(this.currentYear, this.currentMonth - 1).toLocaleString('default', { month: 'long' })
      this.periodTitleTarget.textContent = `${monthName} ${this.currentYear}`
    }
  }

  updateZoomIndicator() {
    if (this.currentView === 'year') {
      this.zoomIndicatorTarget.textContent = 'Year View'
    } else {
      this.zoomIndicatorTarget.textContent = 'Month View'
    }
  }

  // Data Loading
  async loadYearFeatures() {
    try {
      const response = await fetch(`/projects/${this.projectIdValue}/timeline_data?year=${this.currentYear}&view=year`)
      const data = await response.json()
      this.renderYearFeatures(data.features)
    } catch (error) {
      console.error('Error loading year features:', error)
    }
  }

  async loadMonthFeatures() {
    try {
      const response = await fetch(`/projects/${this.projectIdValue}/timeline_data?year=${this.currentYear}&month=${this.currentMonth}&view=month`)
      const data = await response.json()
      this.renderMonthFeatures(data.features)
    } catch (error) {
      console.error('Error loading month features:', error)
    }
  }

  // Rendering Methods
  renderYearFeatures(features) {
    // Clear existing year bars
    this.yearViewTarget.querySelectorAll('.timeline-feature-bar').forEach(bar => {
      bar.remove()
    })

    // Render new features
    features.forEach(feature => {
      this.renderYearFeature(feature)
    })
  }

  renderYearFeature(feature) {
    const contributorId = feature.responsible_contributor_id || 'unassigned'
    const monthArea = this.yearViewTarget.querySelector(`.timeline-month-area[data-contributor-id="${contributorId}"]`)
    if (!monthArea) return

    const startDate = new Date(feature.start_date)
    const endDate = new Date(feature.end_date)
    const startMonth = startDate.getMonth() + 1
    const endMonth = endDate.getMonth() + 1

    // Calculate position and width for year view
    const yearStart = new Date(this.currentYear, 0, 1)
    const yearEnd = new Date(this.currentYear, 11, 31)
    
    const cardStart = new Date(Math.max(startDate, yearStart))
    const cardEnd = new Date(Math.min(endDate, yearEnd))
    
    const startMonthIndex = cardStart.getMonth()
    const endMonthIndex = cardEnd.getMonth()
    
    const leftPercent = (startMonthIndex / 12) * 100
    const widthPercent = ((endMonthIndex - startMonthIndex + 1) / 12) * 100

    // Create feature bar
    const bar = document.createElement('div')
    bar.className = `timeline-feature-bar ${this.getStatusColor(feature)}`
    bar.dataset.featureId = feature.id
    bar.dataset.startDate = feature.start_date
    bar.dataset.endDate = feature.end_date
    bar.style.cssText = `
      position: absolute;
      left: ${leftPercent}%;
      width: ${widthPercent}%;
      height: 20px;
      background-color: ${this.getStatusColor(feature) === 'orange' ? '#ffc107' : this.getStatusColor(feature) === 'blue' ? '#0d6efd' : '#198754'};
      border: 1px solid #000;
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 10px;
      color: white;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      z-index: 10;
      cursor: pointer;
    `
    bar.title = `${feature.name} (${feature.start_date} to ${feature.end_date})`

    const nameSpan = document.createElement('span')
    nameSpan.className = 'feature-name'
    nameSpan.textContent = feature.name
    bar.appendChild(nameSpan)

    // Add overdue warning if applicable
    if (feature.overdue) {
      const overdueIcon = document.createElement('i')
      overdueIcon.className = 'bi bi-exclamation-circle-fill text-danger'
      overdueIcon.style.cssText = 'margin-left: 4px; font-size: 8px;'
      overdueIcon.title = "This feature's end date is overdue"
      overdueIcon.setAttribute('data-bs-toggle', 'tooltip')
      overdueIcon.setAttribute('data-bs-placement', 'top')
      bar.appendChild(overdueIcon)
    }

    // Set up container for absolute positioning
    monthArea.style.position = 'relative'
    monthArea.style.height = '30px'

    monthArea.appendChild(bar)
  }

  renderMonthFeatures(features) {
    // Clear existing month bars
    this.monthViewTarget.querySelectorAll('.timeline-feature-bar').forEach(bar => {
      bar.remove()
    })

    // Render new features
    features.forEach(feature => {
      this.renderMonthFeature(feature)
    })
  }

  renderMonthFeature(feature) {
    const contributorId = feature.responsible_contributor_id || 'unassigned'
    const dayArea = this.monthViewTarget.querySelector(`.timeline-day-area[data-contributor-id="${contributorId}"]`)
    if (!dayArea) return

    const startDate = new Date(feature.start_date)
    const endDate = new Date(feature.end_date)
    const monthStart = new Date(this.currentYear, this.currentMonth - 1, 1)
    const monthEnd = new Date(this.currentYear, this.currentMonth, 0)

    // Check if feature overlaps with current month
    if (startDate > monthEnd || endDate < monthStart) return

    // Calculate position and width for month view
    const cardStart = new Date(Math.max(startDate, monthStart))
    const cardEnd = new Date(Math.min(endDate, monthEnd))

    const monthDays = monthEnd.getDate()
    const startDay = cardStart.getDate()
    const endDay = cardEnd.getDate()

    const leftPercent = ((startDay - 1) / monthDays) * 100
    const widthPercent = ((endDay - startDay + 1) / monthDays) * 100

    // Create feature bar
    const bar = document.createElement('div')
    bar.className = `timeline-feature-bar ${this.getStatusColor(feature)}`
    bar.dataset.featureId = feature.id
    bar.dataset.startDate = feature.start_date
    bar.dataset.endDate = feature.end_date
    bar.style.cssText = `
      position: absolute;
      left: ${leftPercent}%;
      width: ${widthPercent}%;
      height: 20px;
      background-color: ${this.getStatusColor(feature) === 'orange' ? '#ffc107' : this.getStatusColor(feature) === 'blue' ? '#0d6efd' : '#198754'};
      border: 1px solid #000;
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 10px;
      color: white;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      z-index: 10;
      cursor: pointer;
    `
    bar.title = `${feature.name} (${feature.start_date} to ${feature.end_date})`

    const nameSpan = document.createElement('span')
    nameSpan.className = 'feature-name'
    nameSpan.textContent = feature.name
    bar.appendChild(nameSpan)

    // Add overdue warning if applicable
    if (feature.overdue) {
      const overdueIcon = document.createElement('i')
      overdueIcon.className = 'bi bi-exclamation-circle-fill text-danger'
      overdueIcon.style.cssText = 'margin-left: 4px; font-size: 8px;'
      overdueIcon.title = "This feature's end date is overdue"
      overdueIcon.setAttribute('data-bs-toggle', 'tooltip')
      overdueIcon.setAttribute('data-bs-placement', 'top')
      bar.appendChild(overdueIcon)
    }

    // Set up container for absolute positioning
    dayArea.style.position = 'relative'
    dayArea.style.height = '30px'

    dayArea.appendChild(bar)
  }

  // Utility Methods
  getStatusColor(feature) {
    const today = new Date()
    const startDate = new Date(feature.start_date)
    const endDate = new Date(feature.end_date)

    if (today < startDate) {
      return 'orange' // not started
    } else if (today > endDate) {
      return 'green' // done
    } else {
      return 'blue' // in progress
    }
  }
}
