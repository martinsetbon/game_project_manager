import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "sidebar",
    "searchInput",
    "contributorsList",
    "contributorCheckbox",
    "myTasksToggle",
    "monthYear",
    "calendarGrid",
    "tasksData",
    "contributorsData",
    "metadata"
  ]

  get monthYearTextTarget() {
    return this.monthYearTarget.querySelector('.calendar-month-year-text')
  }

  connect() {
    // Load data
    this.loadTasks()
    this.loadContributors()
    this.loadMetadata()
    
    // Initialize selected contributors based on user role
    this.initializeSelectedContributors()
    
    // Set current date
    this.currentDate = new Date()
    this.currentMonth = this.currentDate.getMonth()
    this.currentYear = this.currentDate.getFullYear()
    this.currentWeek = this.getWeekNumber(this.currentDate)
    this.currentDay = this.currentDate.getDate()
    
    // View mode (year, month, week, day)
    this.viewMode = 'year'
    
    // Drag selection state
    this.isDragging = false
    this.hasDragged = false
    this.dragStartDay = null
    this.dragEndDay = null
    this.longPressThreshold = 350
    this.suppressClick = false
    this.isHourDragging = false
    this.dragStartHour = null
    this.dragEndHour = null

    // Task drag/resize state
    this.isTaskDragging = false
    this.isTaskResizing = false
    this.taskDragState = null
    this.taskHoldTimer = null
    this.suppressTaskClick = false
    
    // Render calendar (default to year view on today's date)
    this.goToToday()
    
    // Ensure correct scroll position when tab becomes visible
    this.onTabShown = (event) => {
      if (event.detail?.tab !== 'timeline') return
      this.viewMode = 'year'
      requestAnimationFrame(() => this.goToToday())
    }
    this.element.addEventListener('project-tab-shown', this.onTabShown)
    
    // Filter contributors on search
    if (this.hasSearchInputTarget) {
      this.searchInputTarget.addEventListener('input', () => this.filterContributors())
    }
  }

  disconnect() {
    if (this.onTabShown) {
      this.element.removeEventListener('project-tab-shown', this.onTabShown)
    }
  }

  loadTasks() {
    try {
      const tasksJson = this.tasksDataTarget.textContent
      this.tasks = JSON.parse(tasksJson) || []
      console.log('Loaded tasks:', this.tasks.length, 'tasks')
      if (this.tasks.length > 0) {
        console.log('Sample tasks:', this.tasks.slice(0, 3).map(t => ({
          name: t.name,
          start_date: t.start_date,
          end_date: t.end_date,
          responsible: t.responsible_users?.map(u => u.id) || [],
          accountable: t.accountable_users?.map(u => u.id) || []
        })))
      }
    } catch (e) {
      console.error('Error loading tasks:', e)
      this.tasks = []
    }
  }

  loadContributors() {
    try {
      const contributorsJson = this.contributorsDataTarget.textContent
      this.contributors = JSON.parse(contributorsJson) || []
    } catch (e) {
      console.error('Error loading contributors:', e)
      this.contributors = []
    }
  }

  loadMetadata() {
    const metadata = this.metadataTarget
    this.currentUserId = parseInt(metadata.dataset.currentUserId)
    this.isProjectCreator = metadata.dataset.isProjectCreator === 'true'
    this.projectStartDate = new Date(metadata.dataset.projectStartDate)
    this.projectEndDate = new Date(metadata.dataset.projectEndDate)
  }

  initializeSelectedContributors() {
    this.selectedContributorIds = new Set()
    
    if (this.isProjectCreator) {
      // Project creator sees all by default
      this.contributors.forEach(c => this.selectedContributorIds.add(c.id))
      if (this.hasMyTasksToggleTarget) {
        this.myTasksToggleTarget.textContent = 'My Tasks Only'
        this.myTasksToggleTarget.classList.remove('btn-primary')
        this.myTasksToggleTarget.classList.add('btn-outline-secondary')
      }
    } else {
      // Regular users see only their tasks by default
      this.selectedContributorIds.add(this.currentUserId)
      if (this.hasMyTasksToggleTarget) {
        this.myTasksToggleTarget.textContent = 'Show All'
        this.myTasksToggleTarget.classList.remove('btn-outline-secondary')
        this.myTasksToggleTarget.classList.add('btn-primary')
      }
    }
    
    // Update checkboxes
    this.updateContributorCheckboxes()
  }

  toggleContributor(event) {
    // Prevent event from bubbling if clicking checkbox directly
    if (event.target.type === 'checkbox') {
      event.stopPropagation()
    }
    
    const item = event.currentTarget
    const contributorId = parseInt(item.dataset.contributorId)
    const checkbox = item.querySelector('input[type="checkbox"]')
    
    if (this.selectedContributorIds.has(contributorId)) {
      // Don't allow deselecting if it's the only selected contributor
      if (this.selectedContributorIds.size <= 1) {
        checkbox.checked = true // Keep it checked
        return
      }
      this.selectedContributorIds.delete(contributorId)
      checkbox.checked = false
    } else {
      this.selectedContributorIds.add(contributorId)
      checkbox.checked = true
    }
    
    this.updateContributorCheckboxes()
    this.renderCalendar()
  }

  toggleMyTasksOnly(event) {
    const button = event.currentTarget
    
    // Check actual state instead of button text to avoid sync issues
    const isShowingOnlyMe = this.selectedContributorIds.size === 1 && 
                           this.selectedContributorIds.has(this.currentUserId)
    
    console.log('Toggle button clicked:', {
      isShowingOnlyMe,
      selectedCount: this.selectedContributorIds.size,
      selectedIds: Array.from(this.selectedContributorIds),
      currentUserId: this.currentUserId,
      buttonText: button.textContent.trim()
    })
    
    if (isShowingOnlyMe) {
      // Currently showing my tasks only, switch to all
      this.selectedContributorIds.clear()
      this.contributors.forEach(c => this.selectedContributorIds.add(c.id))
      button.textContent = 'My Tasks Only'
      button.classList.remove('btn-primary')
      button.classList.add('btn-outline-secondary')
    } else {
      // Currently showing all, switch to my tasks only
      this.selectedContributorIds.clear()
      this.selectedContributorIds.add(this.currentUserId)
      button.textContent = 'Show All'
      button.classList.remove('btn-outline-secondary')
      button.classList.add('btn-primary')
    }
    
    console.log('After toggle:', {
      selectedCount: this.selectedContributorIds.size,
      selectedIds: Array.from(this.selectedContributorIds),
      buttonText: button.textContent.trim()
    })
    
    this.updateContributorCheckboxes()
    this.renderCalendar()
  }

  updateContributorCheckboxes() {
    if (!this.hasContributorsListTarget) return
    
    const items = this.contributorsListTarget.querySelectorAll('.contributor-item')
    items.forEach(item => {
      const contributorId = parseInt(item.dataset.contributorId)
      const checkbox = item.querySelector('input[type="checkbox"]')
      const isSelected = this.selectedContributorIds.has(contributorId)
      
      checkbox.checked = isSelected
      item.classList.toggle('selected', isSelected)
    })
  }

  filterContributors() {
    if (!this.hasSearchInputTarget || !this.hasContributorsListTarget) return
    
    const searchTerm = this.searchInputTarget.value.toLowerCase().trim()
    const terms = searchTerm.split(/\s+/).filter(Boolean)
    const items = this.contributorsListTarget.querySelectorAll('.contributor-item')
    
    items.forEach(item => {
      const name = (item.dataset.contributorName || '').toLowerCase()
      const job = (item.dataset.contributorJob || '').toLowerCase()
      const haystack = `${name} ${job}`.trim()
      const matches = terms.length === 0 || terms.every(term => haystack.includes(term))
      item.style.display = matches ? 'flex' : 'none'
    })
  }

  zoomToMonth(month, year) {
    this.currentMonth = month
    this.currentYear = year
    this.viewMode = 'month'
    this.renderCalendar()
  }

  zoomToDay(day, month, year) {
    this.currentDay = day
    this.currentMonth = month
    this.currentYear = year
    this.currentDate = new Date(year, month, day, 0, 0, 0, 0)
    this.viewMode = 'day'
    this.renderCalendar()
  }

  previousPeriod() {
    switch(this.viewMode) {
      case 'year':
        this.currentYear--
        break
      case 'month':
        this.currentMonth--
        if (this.currentMonth < 0) {
          this.currentMonth = 11
          this.currentYear--
        }
        break
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() - 1)
        this.updateCurrentPeriod()
        break
    }
    this.renderCalendar()
  }

  nextPeriod() {
    switch(this.viewMode) {
      case 'year':
        this.currentYear++
        break
      case 'month':
        this.currentMonth++
        if (this.currentMonth > 11) {
          this.currentMonth = 0
          this.currentYear++
        }
        break
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() + 1)
        this.updateCurrentPeriod()
        break
    }
    this.renderCalendar()
  }

  goToToday() {
    const today = new Date()
    if (this.viewMode === 'year') {
      this.currentYear = today.getFullYear()
      this.currentMonth = today.getMonth()
      this.renderCalendar()
      this.scrollToYearMonth(today.getFullYear(), today.getMonth())
      return
    }

    this.currentDate = new Date(today)
    this.currentMonth = today.getMonth()
    this.currentYear = today.getFullYear()
    this.currentWeek = this.getWeekNumber(today)
    this.currentDay = today.getDate()
    this.renderCalendar()
  }

  goToProjectStart() {
    const start = new Date(this.projectStartDate)
    if (this.viewMode === 'year') {
      this.currentYear = start.getFullYear()
      this.currentMonth = start.getMonth()
      this.renderCalendar()
      this.scrollToYearMonth(start.getFullYear(), start.getMonth())
      return
    }

    this.currentDate = new Date(start)
    this.currentMonth = start.getMonth()
    this.currentYear = start.getFullYear()
    this.currentWeek = this.getWeekNumber(start)
    this.currentDay = start.getDate()
    this.viewMode = 'month'
    this.renderCalendar()
  }

  goToProjectEnd() {
    const end = new Date(this.projectEndDate)
    if (this.viewMode === 'year') {
      this.currentYear = end.getFullYear()
      this.currentMonth = end.getMonth()
      this.renderCalendar()
      this.scrollToYearMonth(end.getFullYear(), end.getMonth())
      return
    }

    this.currentDate = new Date(end)
    this.currentMonth = end.getMonth()
    this.currentYear = end.getFullYear()
    this.currentWeek = this.getWeekNumber(end)
    this.currentDay = end.getDate()
    this.viewMode = 'month'
    this.renderCalendar()
  }

  updateCurrentPeriod() {
    this.currentMonth = this.currentDate.getMonth()
    this.currentYear = this.currentDate.getFullYear()
    this.currentWeek = this.getWeekNumber(this.currentDate)
    this.currentDay = this.currentDate.getDate()
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  renderCalendar() {
    // Get filtered tasks for selected contributors
    const filteredTasks = this.getFilteredTasks()
    
    // Update header based on view mode
    this.updateHeader()
    
    // Render appropriate view
    switch(this.viewMode) {
      case 'year':
        this.renderYearView(filteredTasks)
        break
      case 'month':
        this.renderMonthView(filteredTasks)
        break
      case 'day':
        this.renderDayView(filteredTasks)
        break
    }
  }

  updateHeader() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December']
    
    const zoomOutBtn = this.monthYearTarget
    const textElement = this.monthYearTextTarget
    const zoomOutIcon = zoomOutBtn.querySelector('i')
    
    switch(this.viewMode) {
      case 'year':
        // In year view, show just the year (not clickable for zoom out)
        textElement.textContent = `${this.currentYear}`
        zoomOutBtn.style.cursor = 'default'
        zoomOutBtn.style.pointerEvents = 'none'
        zoomOutBtn.style.opacity = '0.5'
        if (zoomOutIcon) zoomOutIcon.style.display = 'none'
        break
      case 'month':
        // In month view, show year (clickable to zoom out to year)
        textElement.textContent = `${this.currentYear}`
        zoomOutBtn.style.cursor = 'pointer'
        zoomOutBtn.style.pointerEvents = 'auto'
        zoomOutBtn.style.opacity = '1'
        if (zoomOutIcon) zoomOutIcon.style.display = ''
        break
      case 'day':
        // In day view, show month and year (clickable to zoom out to month)
        textElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`
        zoomOutBtn.style.cursor = 'pointer'
        zoomOutBtn.style.pointerEvents = 'auto'
        zoomOutBtn.style.opacity = '1'
        if (zoomOutIcon) zoomOutIcon.style.display = ''
        break
    }
  }

  zoomOut() {
    switch(this.viewMode) {
      case 'day':
        // Zoom out from day to month view
        this.viewMode = 'month'
        // Keep current month and year
        this.renderCalendar()
        break
      case 'month':
        // Zoom out from month to year view
        this.viewMode = 'year'
        // Keep current year
        this.renderCalendar()
        break
      case 'year':
        // Already at highest level, do nothing
        break
    }
  }

  getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  getFilteredTasks() {
    // Check if we're showing all contributors (project creator default)
    const showingAll = this.selectedContributorIds.size === this.contributors.length
    const showingOnlyMe = this.selectedContributorIds.size === 1 &&
      this.selectedContributorIds.has(this.currentUserId)
    const toggleableContributorIds = new Set(this.contributors.map(c => c.id))
    
    const filtered = this.tasks.filter(task => {
      // Check if task belongs to any selected contributor
      const responsibleIds = task.responsible_users?.map(u => u.id) || []
      const accountableIds = task.accountable_users?.map(u => u.id) || []
      const taskContributorIds = new Set([...responsibleIds, ...accountableIds])
      
      // If showing all contributors, show all tasks (including unassigned ones)
      if (showingAll) {
        return true
      }
      
      // If task has no assigned users, only show when not in "My Tasks Only"
      if (taskContributorIds.size === 0) {
        return !showingOnlyMe
      }
      
      // Check if any selected contributor is involved in this task
      const matchesSelected = Array.from(this.selectedContributorIds).some(id => taskContributorIds.has(id))
      if (matchesSelected) {
        return true
      }
      
      // If task is assigned to users not in the toggle list, keep it visible
      const hasUntoggleableAssignee = Array.from(taskContributorIds).some(id => !toggleableContributorIds.has(id))
      
      return hasUntoggleableAssignee
    })
    
    console.log('Filtered tasks:', {
      total: this.tasks.length,
      filtered: filtered.length,
      showingAll: showingAll,
      selectedContributors: Array.from(this.selectedContributorIds),
      totalContributors: this.contributors.length,
      sampleFiltered: filtered.slice(0, 2).map(t => ({
        name: t.name,
        start: t.start_date,
        end: t.end_date,
        responsible: t.responsible_users?.map(u => u.id) || [],
        accountable: t.accountable_users?.map(u => u.id) || []
      }))
    })
    
    return filtered
  }

  renderMonthView(tasks) {
    const grid = this.calendarGridTarget
    grid.innerHTML = ''
    grid.className = 'calendar-grid'

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Render all months from project start to project end
    const startYear = this.projectStartDate.getFullYear()
    const startMonth = this.projectStartDate.getMonth()
    const endYear = this.projectEndDate.getFullYear()
    const endMonth = this.projectEndDate.getMonth()

    let year = startYear
    let month = startMonth

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const monthHeader = document.createElement('div')
      monthHeader.className = 'calendar-month-header'
      monthHeader.dataset.monthKey = `${year}-${month}`
      monthHeader.textContent = new Date(year, month, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
      })
      grid.appendChild(monthHeader)

      // Get first day of month and number of days
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const daysInMonth = lastDay.getDate()
      const startingDayOfWeek = firstDay.getDay() // 0 = Sunday, 6 = Saturday

      // Create day labels row
      const dayLabelsRow = document.createElement('div')
      dayLabelsRow.className = 'calendar-weekdays'
      dayLabels.forEach(label => {
        const dayLabel = document.createElement('div')
        dayLabel.className = 'calendar-weekday'
        dayLabel.textContent = label
        dayLabelsRow.appendChild(dayLabel)
      })
      grid.appendChild(dayLabelsRow)

      // Create calendar days
      const daysContainer = document.createElement('div')
      daysContainer.className = 'calendar-days'

      // Add empty cells for days before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div')
        emptyDay.className = 'calendar-day empty'
        daysContainer.appendChild(emptyDay)
      }

      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = this.createDayElement(day, tasks, year, month)
        daysContainer.appendChild(dayElement)
      }

      grid.appendChild(daysContainer)

      // Increment month
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
    }

    if (!this.isTaskDragging && !this.isTaskResizing) {
      this.scrollToCurrentMonth()
    }
  }

  renderYearView(tasks) {
    const grid = this.calendarGridTarget
    grid.innerHTML = ''
    grid.className = 'calendar-grid calendar-year-view'
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const startYear = this.projectStartDate.getFullYear()
    const endYear = this.projectEndDate.getFullYear()
    const today = new Date()
    const projectStart = this.normalizeDate(this.projectStartDate)
    const projectEnd = this.normalizeDate(this.projectEndDate)
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    
    const startMonth = this.projectStartDate.getMonth()
    const endMonth = this.projectEndDate.getMonth()

    for (let year = startYear; year <= endYear; year++) {
      const yearHeader = document.createElement('div')
      yearHeader.className = 'calendar-year-header'
      yearHeader.textContent = year
      yearHeader.dataset.year = year
      grid.appendChild(yearHeader)
      
      // Create 12 month grid (3 columns x 4 rows)
      const monthsContainer = document.createElement('div')
      monthsContainer.className = 'calendar-months'

      const monthStart = year === startYear ? startMonth : 0
      const monthEnd = year === endYear ? endMonth : 11
      
      for (let month = monthStart; month <= monthEnd; month++) {
        const monthElement = document.createElement('div')
        monthElement.className = 'calendar-month-mini'
        monthElement.dataset.month = month
        monthElement.dataset.year = year
        monthElement.style.cursor = 'pointer'
        
        // Add click handler to zoom to this month
        monthElement.addEventListener('click', () => {
          this.zoomToMonth(month, year)
        })
        
        // Month header
        const monthHeader = document.createElement('div')
        monthHeader.className = 'month-mini-header'
        monthHeader.textContent = monthNames[month]
        monthElement.appendChild(monthHeader)
        
        // Day labels (abbreviated)
        const dayLabelsRow = document.createElement('div')
        dayLabelsRow.className = 'month-mini-weekdays'
        dayLabels.forEach(label => {
          const dayLabel = document.createElement('div')
          dayLabel.className = 'month-mini-weekday'
          dayLabel.textContent = label
          dayLabelsRow.appendChild(dayLabel)
        })
        monthElement.appendChild(dayLabelsRow)
        
        // Days grid
        const daysContainer = document.createElement('div')
        daysContainer.className = 'month-mini-days'
        
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()
        
        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
          const emptyDay = document.createElement('div')
          emptyDay.className = 'month-mini-day empty'
          daysContainer.appendChild(emptyDay)
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          const dayDate = new Date(year, month, day, 0, 0, 0, 0)
          const dayElement = document.createElement('div')
          dayElement.className = 'month-mini-day'
          dayElement.textContent = day
          
          // Check if today
          if (dayDate.toDateString() === today.toDateString()) {
            dayElement.classList.add('today')
          }
          
          // Project start/end indicators
          const dayNormalized = this.normalizeDate(dayDate)
          if (dayNormalized.getTime() === projectStart.getTime()) {
            dayElement.classList.add('project-start')
          }
          if (dayNormalized.getTime() === projectEnd.getTime()) {
            dayElement.classList.add('project-end')
          }
          
          // Add tasks for this day (just show indicator dots)
          const dayTasks = this.getTasksForDay(dayDate, tasks)
          if (dayTasks.length > 0) {
            dayElement.classList.add('has-tasks')
            const taskIndicator = document.createElement('div')
            taskIndicator.className = 'month-mini-task-indicator'
            taskIndicator.title = `${dayTasks.length} task(s)`
            dayElement.appendChild(taskIndicator)
          }
          
          daysContainer.appendChild(dayElement)
        }
        
        monthElement.appendChild(daysContainer)
        monthsContainer.appendChild(monthElement)
      }
      
      grid.appendChild(monthsContainer)
    }

    // Keep header year in sync with scroll position
    if (this.yearScrollHandler) {
      grid.removeEventListener('scroll', this.yearScrollHandler)
    }
    this.yearScrollHandler = () => this.updateYearHeaderFromScroll()
    grid.addEventListener('scroll', this.yearScrollHandler)
    this.updateYearHeaderFromScroll()
  }

  renderWeekView(tasks) {
    const grid = this.calendarGridTarget
    grid.innerHTML = ''
    grid.className = 'calendar-grid calendar-week-view'
    
    const weekStart = this.getWeekStart(this.currentDate)
    
    // Create time slots (24 hours)
    const hours = []
    for (let h = 0; h < 24; h++) {
      hours.push(h)
    }
    
    // Create header with days
    const headerRow = document.createElement('div')
    headerRow.className = 'week-header'
    
    const timeColumn = document.createElement('div')
    timeColumn.className = 'week-time-column'
    timeColumn.textContent = 'Time'
    headerRow.appendChild(timeColumn)
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart)
      dayDate.setDate(dayDate.getDate() + i)
      const dayHeader = document.createElement('div')
      dayHeader.className = 'week-day-header'
      
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()]
      const dayNumber = dayDate.getDate()
      
      dayHeader.innerHTML = `
        <div class="week-day-name">${dayName}</div>
        <div class="week-day-number ${this.isToday(dayDate) ? 'today' : ''}">${dayNumber}</div>
      `
      headerRow.appendChild(dayHeader)
    }
    
    grid.appendChild(headerRow)
    
    // Create time grid
    const timeGrid = document.createElement('div')
    timeGrid.className = 'week-time-grid'
    
    hours.forEach(hour => {
      const hourRow = document.createElement('div')
      hourRow.className = 'week-hour-row'
      
      // Time label
      const timeLabel = document.createElement('div')
      timeLabel.className = 'week-time-label'
      timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`
      hourRow.appendChild(timeLabel)
      
      // Day columns
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart)
        dayDate.setDate(dayDate.getDate() + i)
        dayDate.setHours(hour, 0, 0, 0)
        
        const hourCell = document.createElement('div')
        hourCell.className = 'week-hour-cell'
        hourCell.dataset.date = dayDate.toISOString()
        
        // Get tasks for this hour
        const hourTasks = this.getTasksForHour(dayDate, tasks)
        hourTasks.forEach(task => {
          const taskElement = this.createTaskElement(task, dayDate)
          hourCell.appendChild(taskElement)
        })
        
        hourRow.appendChild(hourCell)
      }
      
      timeGrid.appendChild(hourRow)
    })
    
    grid.appendChild(timeGrid)
  }

  renderDayView(tasks) {
    const grid = this.calendarGridTarget
    grid.innerHTML = ''
    grid.className = 'calendar-grid calendar-day-view'
    
    const dayDate = new Date(this.currentYear, this.currentMonth, this.currentDay, 0, 0, 0, 0)
    
    // Create time slots (24 hours)
    const hours = []
    for (let h = 0; h < 24; h++) {
      hours.push(h)
    }
    
    // Create header
    const headerRow = document.createElement('div')
    headerRow.className = 'day-header'
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayDate.getDay()]
    headerRow.textContent = `${dayName}, ${dayDate.toLocaleDateString()}`
    grid.appendChild(headerRow)
    
    // Create time grid
    const timeGrid = document.createElement('div')
    timeGrid.className = 'day-time-grid'
    
    hours.forEach(hour => {
      const hourRow = document.createElement('div')
      hourRow.className = 'day-hour-row'
      
      // Time label
      const timeLabel = document.createElement('div')
      timeLabel.className = 'day-time-label'
      timeLabel.textContent = `${String(hour).padStart(2, '0')}:00`
      hourRow.appendChild(timeLabel)
      
      // Hour cell
      const hourCell = document.createElement('div')
      hourCell.className = 'day-hour-cell'
      const hourDate = new Date(dayDate)
      hourDate.setHours(hour, 0, 0, 0)
      hourCell.dataset.date = hourDate.toISOString()
      
      // Get tasks for this hour
      const hourTasks = this.getTasksForHour(hourDate, tasks)
      hourTasks.forEach(task => {
        const taskElement = this.createTaskElement(task, hourDate, { view: 'day', hourDate })
        hourCell.appendChild(taskElement)
      })

      this.addHourDragHandlers(hourCell, hourDate)
      
      hourRow.appendChild(hourCell)
      timeGrid.appendChild(hourRow)
    })
    
    grid.appendChild(timeGrid)
  }

  isToday(date) {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  getTasksForHour(hourDate, tasks) {
    const hourStart = new Date(hourDate)
    hourStart.setMinutes(0, 0, 0)
    const hourEnd = new Date(hourStart)
    hourEnd.setHours(hourEnd.getHours() + 1)
    
    return tasks.filter(task => {
      if (!task.start_date || !task.end_date) return false
      
      const taskStart = this.combineDateTime(task.start_date, task.start_time, false)
      const taskEnd = this.combineDateTime(task.end_date, task.end_time, true)
      if (!taskStart || !taskEnd) return false
      
      // Task overlaps with this hour if:
      // - Task starts before hour ends AND task ends after hour starts
      return taskStart < hourEnd && taskEnd >= hourStart
    })
  }

  createDayElement(day, tasks, year = this.currentYear, month = this.currentMonth) {
    // Create date at midnight local time to avoid timezone issues
    const dayDate = new Date(year, month, day, 0, 0, 0, 0)
    const dayElement = document.createElement('div')
    dayElement.className = 'calendar-day'
    dayElement.dataset.day = day
    dayElement.dataset.month = month
    dayElement.dataset.year = year
    // Store date as YYYY-MM-DD string for consistent comparison
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    dayElement.dataset.date = dateStr
    
    // Check if today
    const today = new Date()
    if (dayDate.toDateString() === today.toDateString()) {
      dayElement.classList.add('today')
    }

    // Project start/end indicators
    const projectStart = this.normalizeDate(this.projectStartDate)
    const projectEnd = this.normalizeDate(this.projectEndDate)
    const dayNormalized = this.normalizeDate(dayDate)
    if (dayNormalized.getTime() === projectStart.getTime()) {
      dayElement.classList.add('project-start')
    }
    if (dayNormalized.getTime() === projectEnd.getTime()) {
      dayElement.classList.add('project-end')
    }
    
    // Day number
    const dayNumber = document.createElement('div')
    dayNumber.className = 'day-number'
    dayNumber.textContent = day
    dayElement.appendChild(dayNumber)
    
    // Tasks for this day
    const dayTasks = this.getTasksForDay(dayDate, tasks)
    const tasksContainer = document.createElement('div')
    tasksContainer.className = 'day-tasks'
    
    if (dayTasks.length > 0) {
      dayTasks.forEach(task => {
        const taskElement = this.createTaskElement(task, dayDate)
        tasksContainer.appendChild(taskElement)
      })
    }
    
    dayElement.appendChild(tasksContainer)
    
    // Add click handler to zoom to day view (but not on tasks)
    dayElement.addEventListener('click', (e) => {
      // Don't zoom if clicking on a task
      if (this.suppressClick) {
        this.suppressClick = false
        return
      }
      if (!e.target.closest('.calendar-task')) {
        this.zoomToDay(day, month, year)
      }
    })
    
    // Add drag selection handlers
    this.addDragHandlers(dayElement, dayDate)
    
    return dayElement
  }

  addDragHandlers(dayElement, dayDate) {
    let holdTimer = null
    let longPressTriggered = false
    
    // Mouse down - start long press timer
    dayElement.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on a task
      if (e.target.closest('.calendar-task')) {
        return
      }
      
      e.preventDefault()
      e.stopPropagation()
      
      this.hasDragged = false
      longPressTriggered = false
      
      holdTimer = window.setTimeout(() => {
        longPressTriggered = true
        this.isDragging = true
        this.dragStartDay = dayDate
        this.dragEndDay = dayDate
        dayElement.classList.add('drag-selected')
        this.updateDragSelection()
        
        // Add global mouse move handler
        this.mouseMoveHandler = (e) => {
          if (!this.isDragging) return
          
          this.hasDragged = true
          
          // Find which day cell the mouse is over
          const elementBelow = document.elementFromPoint(e.clientX, e.clientY)
          const dayCell = elementBelow?.closest('.calendar-day:not(.empty)')
          
          if (dayCell && dayCell.dataset.date) {
            // Parse date string YYYY-MM-DD using normalizeDate helper
            const hoverDate = this.normalizeDate(dayCell.dataset.date)
            this.dragEndDay = hoverDate
            this.updateDragSelection()
          }
        }
        
        // Add global mouse up handler
        this.mouseUpHandler = () => {
          if (!this.isDragging) return
          
          this.isDragging = false
          this.suppressClick = true
          
          if (this.dragStartDay && this.dragEndDay) {
            const startDate = this.dragStartDay < this.dragEndDay ? this.dragStartDay : this.dragEndDay
            const endDate = this.dragStartDay > this.dragEndDay ? this.dragStartDay : this.dragEndDay
            this.openTaskCreationModal(this.normalizeDate(startDate), this.normalizeDate(endDate))
          }
          
          this.clearDragSelection()
          
          // Remove global handlers
          document.removeEventListener('mousemove', this.mouseMoveHandler)
          document.removeEventListener('mouseup', this.mouseUpHandler)
          this.mouseMoveHandler = null
          this.mouseUpHandler = null
        }
        
        document.addEventListener('mousemove', this.mouseMoveHandler)
        document.addEventListener('mouseup', this.mouseUpHandler)
      }, this.longPressThreshold)
    })
    
    dayElement.addEventListener('mouseup', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })
    
    dayElement.addEventListener('mouseleave', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })
  }

  addHourDragHandlers(hourCell, hourDate) {
    let holdTimer = null
    let longPressTriggered = false
    
    hourCell.addEventListener('mousedown', (e) => {
      if (e.target.closest('.calendar-task')) {
        return
      }
      
      e.preventDefault()
      e.stopPropagation()
      
      this.hasDragged = false
      longPressTriggered = false
      
      holdTimer = window.setTimeout(() => {
        longPressTriggered = true
        this.isHourDragging = true
        this.dragStartHour = hourDate
        this.dragEndHour = hourDate
        hourCell.classList.add('hour-drag-selected')
        this.updateHourDragSelection()
        
        this.hourMouseMoveHandler = (e) => {
          if (!this.isHourDragging) return
          
          this.hasDragged = true
          const elementBelow = document.elementFromPoint(e.clientX, e.clientY)
          const hoverCell = elementBelow?.closest('.day-hour-cell')
          
          if (hoverCell && hoverCell.dataset.date) {
            this.dragEndHour = new Date(hoverCell.dataset.date)
            this.updateHourDragSelection()
          }
        }
        
        this.hourMouseUpHandler = () => {
          if (!this.isHourDragging) return
          
          this.isHourDragging = false
          this.suppressClick = true
          
          if (this.dragStartHour && this.dragEndHour) {
            const startDate = this.dragStartHour < this.dragEndHour ? this.dragStartHour : this.dragEndHour
            const endDate = this.dragStartHour > this.dragEndHour ? this.dragStartHour : this.dragEndHour
            const endWithHour = new Date(endDate)
            endWithHour.setHours(endWithHour.getHours() + 1)
            
            this.openTaskCreationModal(
              startDate,
              endWithHour,
              this.formatTime(startDate),
              this.formatTime(endWithHour)
            )
          }
          
          this.clearHourDragSelection()
          
          document.removeEventListener('mousemove', this.hourMouseMoveHandler)
          document.removeEventListener('mouseup', this.hourMouseUpHandler)
          this.hourMouseMoveHandler = null
          this.hourMouseUpHandler = null
        }
        
        document.addEventListener('mousemove', this.hourMouseMoveHandler)
        document.addEventListener('mouseup', this.hourMouseUpHandler)
      }, this.longPressThreshold)
    })
    
    hourCell.addEventListener('mouseup', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })
    
    hourCell.addEventListener('mouseleave', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })
  }

  updateDragSelection() {
    if (!this.dragStartDay || !this.dragEndDay) return
    
    // Normalize dates to midnight for comparison
    const startDate = this.normalizeDate(this.dragStartDay < this.dragEndDay ? this.dragStartDay : this.dragEndDay)
    const endDate = this.normalizeDate(this.dragStartDay > this.dragEndDay ? this.dragStartDay : this.dragEndDay)
    
    const allDays = this.calendarGridTarget.querySelectorAll('.calendar-day:not(.empty)')
    allDays.forEach(dayEl => {
      // Parse date string YYYY-MM-DD
      const dayDate = this.normalizeDate(dayEl.dataset.date)
      
      dayEl.classList.remove('drag-selected', 'drag-range-start', 'drag-range-end', 'drag-range-middle')
      
      if (dayDate >= startDate && dayDate <= endDate) {
        dayEl.classList.add('drag-selected')
        
        if (dayDate.getTime() === startDate.getTime()) {
          dayEl.classList.add('drag-range-start')
        } else if (dayDate.getTime() === endDate.getTime()) {
          dayEl.classList.add('drag-range-end')
        } else {
          dayEl.classList.add('drag-range-middle')
        }
      }
    })
  }

  updateHourDragSelection() {
    if (!this.dragStartHour || !this.dragEndHour) return
    
    const startHour = this.dragStartHour < this.dragEndHour ? this.dragStartHour : this.dragEndHour
    const endHour = this.dragStartHour > this.dragEndHour ? this.dragStartHour : this.dragEndHour
    
    const allHours = this.calendarGridTarget.querySelectorAll('.day-hour-cell')
    allHours.forEach(hourEl => {
      const hourDate = new Date(hourEl.dataset.date)
      hourEl.classList.remove('hour-drag-selected', 'hour-drag-range-start', 'hour-drag-range-end', 'hour-drag-range-middle')
      
      if (hourDate >= startHour && hourDate <= endHour) {
        hourEl.classList.add('hour-drag-selected')
        
        if (hourDate.getTime() === startHour.getTime()) {
          hourEl.classList.add('hour-drag-range-start')
        } else if (hourDate.getTime() === endHour.getTime()) {
          hourEl.classList.add('hour-drag-range-end')
        } else {
          hourEl.classList.add('hour-drag-range-middle')
        }
      }
    })
  }

  clearDragSelection() {
    const allDays = this.calendarGridTarget.querySelectorAll('.calendar-day')
    allDays.forEach(dayEl => {
      dayEl.classList.remove('drag-selected', 'drag-range-start', 'drag-range-end', 'drag-range-middle')
    })
    this.dragStartDay = null
    this.dragEndDay = null
  }

  clearHourDragSelection() {
    const allHours = this.calendarGridTarget.querySelectorAll('.day-hour-cell')
    allHours.forEach(hourEl => {
      hourEl.classList.remove('hour-drag-selected', 'hour-drag-range-start', 'hour-drag-range-end', 'hour-drag-range-middle')
    })
    this.dragStartHour = null
    this.dragEndHour = null
  }

  openTaskCreationModal(startDate, endDate, startTime = null, endTime = null) {
    // Format dates for input fields
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const formatTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    // Set modal form values
    const modal = document.getElementById('calendarTaskModal')
    if (!modal) {
      console.warn('Task creation modal not found - user may not have permission to create tasks')
      return
    }
    
    const startDateInput = modal.querySelector('#task_start_date')
    const endDateInput = modal.querySelector('#task_end_date')
    const startTimeInput = modal.querySelector('#task_start_time')
    const endTimeInput = modal.querySelector('#task_end_time')
    const nameInput = modal.querySelector('#task_name')
    const durationInput = modal.querySelector('#task_duration')
    
    // Clear any previous error messages
    const errorDiv = modal.querySelector('.alert-danger')
    if (errorDiv) {
      errorDiv.remove()
    }
    
    // Reset form
    const form = modal.querySelector('form')
    if (form) {
      form.reset()
    }
    
    // Set dates
    if (startDateInput) startDateInput.value = formatDate(startDate)
    if (endDateInput) endDateInput.value = formatDate(endDate)
    if (startTimeInput) startTimeInput.value = startTime || ''
    if (endTimeInput) endTimeInput.value = endTime || ''
    if (nameInput) nameInput.value = ''
    
    // Calculate duration
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    if (durationInput && duration > 0) {
      durationInput.value = duration
    }
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal)
    bsModal.show()
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  parseLocalDate(date) {
    if (!date) return null
    if (date instanceof Date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    }
    if (typeof date === 'string') {
      const datePart = date.split('T')[0]
      if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = datePart.split('-')
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      }
      const parsed = new Date(date)
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    }
    return null
  }

  combineDateTime(date, time, isEnd) {
    const baseDate = this.parseLocalDate(date)
    if (!baseDate) return null
    if (!time) {
      if (isEnd) {
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999)
      }
      return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0)
    }
    const timeParts = time.split(':')
    const hours = parseInt(timeParts[0] || '0', 10)
    const minutes = parseInt(timeParts[1] || '0', 10)
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0)
  }

  // Helper method to normalize dates to midnight for consistent comparison
  normalizeDate(date) {
    if (typeof date === 'string') {
      // Parse ISO date string (YYYY-MM-DD or ISO8601)
      // Handle both YYYY-MM-DD and ISO8601 formats
      let dateObj
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format - parse as local date
        const parts = date.split('-')
        dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      } else {
        // ISO8601 format - parse and convert to local
        dateObj = new Date(date)
      }
      return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0)
    }
    // Date object - normalize to midnight
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  }

  getTasksForDay(dayDate, tasks) {
    // Normalize dayDate to midnight for comparison
    const dayStart = this.normalizeDate(dayDate)
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 23, 59, 59, 999)
    
    const matchingTasks = tasks.filter(task => {
      if (!task.start_date || !task.end_date) {
        return false
      }
      
      // Parse task dates and normalize to midnight
      const taskStartNormalized = this.normalizeDate(task.start_date)
      const taskEndNormalized = this.normalizeDate(task.end_date)
      
      // Check if day falls within task range (inclusive)
      // Day overlaps task if: dayStart <= taskEnd AND dayEnd >= taskStart
      const matches = dayStart <= taskEndNormalized && dayEnd >= taskStartNormalized
      
      // Debug for first day and first task
      if (dayDate.getDate() === 1 && tasks.indexOf(task) === 0) {
        console.log('Date comparison debug:', {
          dayDate: dayDate.toISOString(),
          dayStart: dayStart.toISOString(),
          dayEnd: dayEnd.toISOString(),
          taskStart: task.start_date,
          taskStartNormalized: taskStartNormalized.toISOString(),
          taskEnd: task.end_date,
          taskEndNormalized: taskEndNormalized.toISOString(),
          matches: matches,
          condition1: dayStart <= taskEndNormalized,
          condition2: dayEnd >= taskStartNormalized
        })
      }
      
      return matches
    })
    
    return matchingTasks
  }

  createTaskElement(task, dayDate, options = {}) {
    const taskElement = document.createElement('div')
    const status = task.status || 'not_started'
    const priority = task.priority || 'none'
    taskElement.className = `calendar-task status-${status} priority-${priority}`
    taskElement.dataset.taskId = task.id
    const isDayView = options.view === 'day'
    
    // Set feature text color using CSS custom property (matching task list)
    if (task.project_feature_id) {
      const featureColor = this.getFeatureTextColor(task.project_feature_id)
      taskElement.style.setProperty('--feature-text-color', featureColor)
    }
    
    // Set status background color inline as fallback
    const statusColors = {
      'not_started': 'rgba(234, 179, 8, 0.2)',
      'work_in_progress': 'rgba(59, 130, 246, 0.2)',
      'stand_by': 'rgba(107, 114, 128, 0.2)',
      'job_done': 'rgba(16, 185, 129, 0.2)'
    }
    if (statusColors[status]) {
      taskElement.style.backgroundColor = statusColors[status]
    }
    
    // Set priority border color inline as fallback (matching task list exactly)
    const priorityColors = {
      'high': { color: '#dc3545', width: '3px' },
      'medium': { color: '#ffc107', width: '2px' },
      'low': { color: '#28a745', width: '2px' },
      'none': { color: 'rgba(255, 255, 255, 0.3)', width: '2px' }
    }
    if (priorityColors[priority]) {
      taskElement.style.borderLeftColor = priorityColors[priority].color
      taskElement.style.borderLeftWidth = priorityColors[priority].width
      taskElement.style.borderLeftStyle = 'solid'
    }
    
    // Normalize dates for comparison
    const dayNormalized = this.normalizeDate(dayDate)
    const taskStartNormalized = this.normalizeDate(task.start_date)
    const taskEndNormalized = this.normalizeDate(task.end_date)
    
    // Check if this is the first day of the task
    const isFirstDay = dayNormalized.getTime() === taskStartNormalized.getTime()
    
    // Check if this is the last day of the task
    const isLastDay = dayNormalized.getTime() === taskEndNormalized.getTime()
    
    if (isFirstDay) {
      taskElement.classList.add('task-start')
    }
    if (isLastDay) {
      taskElement.classList.add('task-end')
    }

    if (isDayView) {
      taskElement.classList.add('day-view-task')
    }
    
    // Task label
    const taskLabel = document.createElement('span')
    taskLabel.className = 'task-label'
    taskLabel.textContent = task.name
    taskElement.appendChild(taskLabel)
    
    // Format dates for title
    const taskStartDate = new Date(task.start_date)
    const taskEndDate = new Date(task.end_date)
    taskElement.title = `${task.name} (${taskStartDate.toLocaleDateString()} - ${taskEndDate.toLocaleDateString()})`
    
    // Add click handler to navigate to task show page
    taskElement.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent day cell click
      e.preventDefault() // Prevent any default behavior

      if (this.suppressTaskClick || this.isTaskDragging || this.isTaskResizing) {
        this.suppressTaskClick = false
        return
      }
      
      // Navigate to task show view
      const projectId = window.location.pathname.match(/\/projects\/(\d+)/)?.[1]
      if (projectId && task.id) {
        window.location.href = `/projects/${projectId}/tasks/${task.id}`
      }
    })
    
    // Drag to move task (long press)
    taskElement.addEventListener('mousedown', (e) => {
      if (e.target.closest('.task-resize-handle')) return
      if (isDayView) return
      this.startTaskMoveHold(e, task)
    })
    taskElement.addEventListener('mouseup', () => this.clearTaskHoldTimer())
    taskElement.addEventListener('mouseleave', () => this.clearTaskHoldTimer())
    
    // Get task color based on responsible/accountable users
    const taskContributors = [...(task.responsible_users || []), ...(task.accountable_users || [])]
    const selectedContributor = taskContributors.find(c => this.selectedContributorIds.has(c.id))
    
    if (selectedContributor) {
      // Use contributor color
      const colorIndex = this.contributors.findIndex(c => c.id === selectedContributor.id)
      if (colorIndex >= 0) {
        taskElement.style.borderLeftColor = this.getContributorColor(colorIndex)
      }
    }
    
    // Add visual indicators for multi-day tasks
    if (!isFirstDay && !isLastDay) {
      taskElement.classList.add('task-continuation')
    }

    // Resize handles
    if (!isDayView) {
      if (isFirstDay) {
        const startHandle = document.createElement('span')
        startHandle.className = 'task-resize-handle handle-start'
        startHandle.title = 'Extend task start'
        startHandle.addEventListener('mousedown', (e) => this.beginTaskResize(e, task, 'start'))
        taskElement.appendChild(startHandle)
      }
      if (isLastDay) {
        const endHandle = document.createElement('span')
        endHandle.className = 'task-resize-handle handle-end'
        endHandle.title = 'Extend task end'
        endHandle.addEventListener('mousedown', (e) => this.beginTaskResize(e, task, 'end'))
        taskElement.appendChild(endHandle)
      }
    } else {
      const taskStart = this.combineDateTime(task.start_date, task.start_time, false)
      const taskEnd = this.combineDateTime(task.end_date, task.end_time, true)
      if (taskStart && taskEnd) {
        const isTaskStartDay = dayNormalized.getTime() === taskStartNormalized.getTime()
        const isTaskEndDay = dayNormalized.getTime() === taskEndNormalized.getTime()

        const hourStart = new Date(options.hourDate)
        hourStart.setMinutes(0, 0, 0)
        const hourEnd = new Date(hourStart)
        hourEnd.setHours(hourEnd.getHours() + 1)
        const isFirstHour = isTaskStartDay && taskStart >= hourStart && taskStart < hourEnd

        const endForCell = new Date(taskEnd)
        if (taskEnd.getMinutes() === 0 && taskEnd.getSeconds() === 0) {
          endForCell.setMinutes(endForCell.getMinutes() + 1)
        }
        const isLastHour = isTaskEndDay && endForCell > hourStart && endForCell <= hourEnd

        if (isFirstHour) {
          taskElement.classList.add('task-hour-start')
          const startHandle = document.createElement('span')
          startHandle.className = 'task-resize-handle handle-top'
          startHandle.title = 'Extend task start time'
          startHandle.addEventListener('mousedown', (e) => this.beginTaskHourResize(e, task, 'start'))
          taskElement.appendChild(startHandle)
        }
        if (isLastHour) {
          taskElement.classList.add('task-hour-end')
          const endHandle = document.createElement('span')
          endHandle.className = 'task-resize-handle handle-bottom'
          endHandle.title = 'Extend task end time'
          endHandle.addEventListener('mousedown', (e) => this.beginTaskHourResize(e, task, 'end'))
          taskElement.appendChild(endHandle)
        }
      }
    }
    
    return taskElement
  }

  getContributorColor(index) {
    // Color palette matching the feature color helper
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
      '#EC7063', '#5DADE2', '#F1948A', '#73C6B6', '#F4D03F',
      '#AF7AC5', '#76D7C4', '#F5B041', '#85C1E9', '#82E0AA'
    ]
    return colors[index % colors.length]
  }

  getFeatureTextColor(featureId) {
    // Color palette matching the Ruby helper feature_text_color
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Sky Blue
      '#F8B739', // Orange
      '#52BE80', // Green
      '#EC7063', // Coral
      '#5DADE2', // Light Blue
      '#F1948A', // Pink
      '#73C6B6', // Turquoise
      '#F4D03F', // Gold
      '#AF7AC5', // Lavender
      '#76D7C4', // Aqua
      '#F5B041', // Amber
      '#85C1E9', // Powder Blue
      '#82E0AA'  // Light Green
    ]
    return colors[featureId % colors.length]
  }

  getDefaultTextColor() {
    // Default text color matching task list
    return 'rgba(255, 255, 255, 1)'
  }

  scrollToCurrentMonth() {
    const monthKey = `${this.currentYear}-${this.currentMonth}`
    const header = this.calendarGridTarget.querySelector(`[data-month-key="${monthKey}"]`)
    if (header) {
      header.scrollIntoView({ block: 'start' })
    }
  }

  scrollToYearMonth(year, month) {
    requestAnimationFrame(() => {
      const monthElement = this.calendarGridTarget.querySelector(
        `.calendar-month-mini[data-year="${year}"][data-month="${month}"]`
      )
      if (monthElement) {
        monthElement.scrollIntoView({ block: 'start' })
      }
    })
  }

  updateYearHeaderFromScroll() {
    if (this.viewMode !== 'year') return

    const grid = this.calendarGridTarget
    const headers = Array.from(grid.querySelectorAll('.calendar-year-header'))
    if (headers.length === 0) return

    const gridRect = grid.getBoundingClientRect()
    let closest = headers[0]
    let closestDistance = Number.POSITIVE_INFINITY

    headers.forEach(header => {
      const headerRect = header.getBoundingClientRect()
      const distance = Math.abs(headerRect.top - gridRect.top)
      if (distance < closestDistance) {
        closestDistance = distance
        closest = header
      }
    })

    const year = parseInt(closest.dataset.year, 10)
    if (!Number.isNaN(year) && year !== this.currentYear) {
      this.currentYear = year
      this.updateHeader()
    }
  }

  clearTaskHoldTimer() {
    if (this.taskHoldTimer) {
      window.clearTimeout(this.taskHoldTimer)
      this.taskHoldTimer = null
    }
  }

  startTaskMoveHold(event, task) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    this.clearTaskHoldTimer()

    this.taskHoldTimer = window.setTimeout(() => {
      this.suppressTaskClick = true
      this.isTaskDragging = true
      const startDate = this.normalizeDate(task.start_date)
      const endDate = this.normalizeDate(task.end_date)
      const durationDays = Math.round((endDate - startDate) / 86400000) + 1
      this.taskDragState = {
        type: 'move',
        task,
        startDate,
        endDate,
        durationDays,
        originalStartDate: startDate,
        originalEndDate: endDate,
        lastHoverDate: null
      }
      this.startTaskDragHandlers()
    }, this.longPressThreshold)
  }

  beginTaskResize(event, task, direction) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    this.clearTaskHoldTimer()

    this.suppressTaskClick = true
    this.isTaskResizing = true
    const startDate = this.normalizeDate(task.start_date)
    const endDate = this.normalizeDate(task.end_date)
    const durationDays = Math.round((endDate - startDate) / 86400000) + 1
    this.taskDragState = {
      type: direction === 'start' ? 'resize-start' : 'resize-end',
      task,
      startDate,
      endDate,
      durationDays,
      originalStartDate: startDate,
      originalEndDate: endDate,
      lastHoverDate: null
    }
    this.startTaskDragHandlers()
  }

  beginTaskHourResize(event, task, direction) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    this.clearTaskHoldTimer()

    const startTime = task.start_time || '00:00'
    const endTime = task.end_time || '23:59'
    this.suppressTaskClick = true
    this.isTaskResizing = true
    this.taskDragState = {
      type: direction === 'start' ? 'resize-hour-start' : 'resize-hour-end',
      task,
      originalStartTime: startTime,
      originalEndTime: endTime,
      lastHoverDate: null
    }
    this.startTaskDragHandlers()
  }

  startTaskDragHandlers() {
    this.taskMouseMoveHandler = (e) => this.handleTaskDragMove(e)
    this.taskMouseUpHandler = () => this.finishTaskDrag()
    document.addEventListener('mousemove', this.taskMouseMoveHandler)
    document.addEventListener('mouseup', this.taskMouseUpHandler)
  }

  handleTaskDragMove(event) {
    if (!this.taskDragState) return

    if (this.taskDragState.type === 'resize-hour-start' || this.taskDragState.type === 'resize-hour-end') {
      const elementBelow = document.elementFromPoint(event.clientX, event.clientY)
      const hourCell = elementBelow?.closest('.day-hour-cell')
      if (!hourCell || !hourCell.dataset.date) return

      const hoverDate = new Date(hourCell.dataset.date)
      const hour = hoverDate.getHours()
      const newStartTime = this.formatTimeHHMM(hour, 0)
      const newEndTime = this.formatTimeHHMM(Math.min(hour + 1, 23), hour === 23 ? 59 : 0)

      if (this.taskDragState.type === 'resize-hour-start') {
        if (this.compareTimes(newStartTime, this.taskDragState.task.end_time || '23:59') > 0) {
          return
        }
        this.taskDragState.task.start_time = newStartTime
      } else {
        if (this.compareTimes(this.taskDragState.task.start_time || '00:00', newEndTime) > 0) {
          return
        }
        this.taskDragState.task.end_time = newEndTime
      }

      this.renderCalendar()
      return
    }

    const elementBelow = document.elementFromPoint(event.clientX, event.clientY)
    const dayCell = elementBelow?.closest('.calendar-day:not(.empty)')
    if (!dayCell || !dayCell.dataset.date) return

    const hoverDate = this.normalizeDate(dayCell.dataset.date)
    if (this.taskDragState.lastHoverDate === dayCell.dataset.date) return

    let newStart = this.taskDragState.startDate
    let newEnd = this.taskDragState.endDate

    if (this.taskDragState.type === 'move') {
      newStart = hoverDate
      newEnd = this.addDays(hoverDate, this.taskDragState.durationDays - 1)
    } else if (this.taskDragState.type === 'resize-start') {
      newStart = hoverDate
      if (newStart > newEnd) {
        newStart = newEnd
      }
    } else if (this.taskDragState.type === 'resize-end') {
      newEnd = hoverDate
      if (newEnd < newStart) {
        newEnd = newStart
      }
    }

    this.taskDragState.lastHoverDate = dayCell.dataset.date
    this.taskDragState.startDate = newStart
    this.taskDragState.endDate = newEnd

    const updatedStart = this.formatDateYMD(newStart)
    const updatedEnd = this.formatDateYMD(newEnd)

    if (this.taskDragState.task.start_date !== updatedStart || this.taskDragState.task.end_date !== updatedEnd) {
      this.taskDragState.task.start_date = updatedStart
      this.taskDragState.task.end_date = updatedEnd
      this.renderCalendar()
    }
  }

  async finishTaskDrag() {
    if (!this.isTaskDragging && !this.isTaskResizing) return

    document.removeEventListener('mousemove', this.taskMouseMoveHandler)
    document.removeEventListener('mouseup', this.taskMouseUpHandler)
    this.taskMouseMoveHandler = null
    this.taskMouseUpHandler = null

    const task = this.taskDragState?.task
    const dragType = this.taskDragState?.type
    const originalStart = this.taskDragState?.originalStartDate
    const originalEnd = this.taskDragState?.originalEndDate
    const originalStartTime = this.taskDragState?.originalStartTime
    const originalEndTime = this.taskDragState?.originalEndTime
    this.isTaskDragging = false
    this.isTaskResizing = false
    this.taskDragState = null
    this.suppressClick = true

    if (task) {
      if (dragType === 'resize-hour-start' || dragType === 'resize-hour-end') {
        const saved = await this.persistTaskTimes(task)
        if (saved === false && originalStartTime && originalEndTime) {
          task.start_time = originalStartTime
          task.end_time = originalEndTime
          this.renderCalendar()
        }
      } else {
        const saved = await this.persistTaskDates(task)
        if (saved === false && originalStart && originalEnd) {
          task.start_date = this.formatDateYMD(originalStart)
          task.end_date = this.formatDateYMD(originalEnd)
          this.renderCalendar()
        }
      }
    }
  }

  addDays(date, days) {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return this.normalizeDate(result)
  }

  formatDateYMD(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  formatTimeHHMM(hour, minute) {
    const h = String(hour).padStart(2, '0')
    const m = String(minute).padStart(2, '0')
    return `${h}:${m}`
  }

  compareTimes(a, b) {
    const [aH, aM] = a.split(':').map(Number)
    const [bH, bM] = b.split(':').map(Number)
    if (aH !== bH) return aH - bH
    return aM - bM
  }

  async persistTaskDates(task) {
    const projectId = window.location.pathname.match(/\/projects\/(\d+)/)?.[1]
    if (!projectId || !task?.id) return

    try {
      return await this.updateTaskField(projectId, task.id, 'date_range', null, {
        start_date: task.start_date,
        end_date: task.end_date
      })
    } catch (error) {
      console.error('Error updating task dates:', error)
      return false
    }
  }

  async persistTaskTimes(task) {
    const projectId = window.location.pathname.match(/\/projects\/(\d+)/)?.[1]
    if (!projectId || !task?.id) return

    try {
      return await this.updateTaskField(projectId, task.id, 'time_range', null, {
        start_time: task.start_time,
        end_time: task.end_time
      })
    } catch (error) {
      console.error('Error updating task times:', error)
      return false
    }
  }

  async updateTaskField(projectId, taskId, field, value, extra = {}) {
    const payload = { field: field, value: value, ...extra }
    const response = await fetch(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.status === 409) {
      const data = await response.json()
      if (data.status === 'overlap_warning') {
        const proceed = window.confirm(`${data.message}\n\nDo you want to proceed anyway?`)
        if (proceed) {
          return this.updateTaskField(projectId, taskId, field, value, { ...extra, proceed: true })
        }
        return false
      }
    }

    if (!response.ok) {
      let errorMessage = 'Failed to update task'
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        errorMessage = data.errors ? data.errors.join(', ') : errorMessage
      }
      throw new Error(errorMessage)
    }

    return true
  }

  reloadTasks() {
    // Reload tasks by re-reading the data attribute
    const tasksDataElement = this.tasksDataTarget
    if (tasksDataElement) {
      try {
        const tasksJson = tasksDataElement.textContent
        this.tasks = JSON.parse(tasksJson) || []
        this.tasks = this.tasks.filter(t => t.start_date && t.end_date)
        this.renderCalendar()
      } catch (e) {
        console.error('Error reloading tasks:', e)
        // Fallback: reload page
        window.location.reload()
      }
    } else {
      // Fallback: reload page
      window.location.reload()
    }
  }
}
