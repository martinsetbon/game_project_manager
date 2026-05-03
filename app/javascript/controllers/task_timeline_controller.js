import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "wrapper",
    "scrollContainer",
    "contributorsColumn",
    "contributorsList",
    "timelineArea",
    "headerArea",
    "rowsArea",
    "myTasksToggle"
  ]

  connect() {
    this.activeFilters = new Set()
    this.myTasksOnly = false
    this.longPressThreshold = 350
    this.isDragging = false
    this.dragStartX = null
    this.dragEndX = null
    this.dragRow = null
    this.dragSelectionEl = null
    this.isTaskDragging = false
    this.isTaskResizing = false
    this.taskDragState = null
    this.taskHoldTimer = null
    this.suppressTaskClick = false
    
    // Get project dates
    const startDateStr = this.wrapperTarget.dataset.projectStartDate
    const endDateStr = this.wrapperTarget.dataset.projectEndDate
    this.projectStartDate = new Date(startDateStr)
    this.projectEndDate = new Date(endDateStr)
    
    // Get current user ID
    this.currentUserId = parseInt(this.wrapperTarget.dataset.currentUserId)
    this.isProjectCreator = this.wrapperTarget.dataset.isProjectCreator === 'true'
    
    // Calculate total days
    this.totalDays = Math.ceil((this.projectEndDate - this.projectStartDate) / (1000 * 60 * 60 * 24))
    
    // Zoom settings - represents zoom level from 0 (max zoom in) to 1 (max zoom out)
    this.minZoomLevel = 0 // Maximum zoom in: 7 days visible in timeline width
    this.maxZoomLevel = 1 // Maximum zoom out: full project visible in timeline width
    this.currentZoomLevel = 1 // Start zoomed out
    this.projectId = this.wrapperTarget.dataset.projectId || this.extractProjectId()
    this.loadZoomLevel()
    this.loadTimelineState()
    
    // Initialize empty arrays first
    this.allTasks = []
    this.allProjectContributors = []
    
    // Store scroll handlers to prevent duplicates
    this.scrollHandlers = {
      rowsHorizontalScroll: null,
      headerScroll: null,
      rowsVerticalScroll: null,
      contributorsScroll: null,
      rowsScrollHandler: null
    }
    
    // Load tasks and contributors data
    this.loadTasks()
    this.loadContributors()
    this.loadFeatureTemplates()
    
    // Initialize timeline after a short delay to ensure DOM is ready
    setTimeout(() => {
      console.log('Initializing task timeline with:', {
        tasks: this.allTasks.length,
        contributors: this.allProjectContributors.length
      })
      this.renderTimeline()
    }, 100)
    
    // Add wheel event listener for zooming
    this.timelineAreaTarget.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false })

    if (this.hasMyTasksToggleTarget) {
      this.updateMyTasksToggle()
    }
  }

  loadTasks() {
    try {
      const tasksJson = this.wrapperTarget.dataset.tasks
      console.log('Raw tasks JSON:', tasksJson)
      if (tasksJson && tasksJson.trim() !== '') {
        // Try to parse - handle potential HTML entity encoding
        let jsonString = tasksJson
        // Decode HTML entities if present
        if (jsonString.includes('&quot;') || jsonString.includes('&amp;')) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = jsonString
          jsonString = tempDiv.textContent || tempDiv.innerText || jsonString
        }
        this.allTasks = JSON.parse(jsonString)
        console.log('Loaded tasks:', this.allTasks.length)
      } else {
        this.allTasks = []
      }
    } catch (e) {
      console.error('Error loading tasks:', e)
      console.error('JSON string was:', this.wrapperTarget.dataset.tasks)
      this.allTasks = []
    }
  }

  loadFeatureTemplates() {
    try {
      const raw = this.wrapperTarget.dataset.featureTemplatesDetailJson
      if (raw && raw.trim() !== '') {
        this.featureTemplates = JSON.parse(raw)
      } else {
        this.featureTemplates = []
      }
    } catch (e) {
      console.warn('featureTemplatesDetailJson parse error', e)
      this.featureTemplates = []
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

  toggleMyTasksFilter(event) {
    const button = event.currentTarget
    this.myTasksOnly = !this.myTasksOnly
    this.persistTimelineState()
    this.updateMyTasksToggle()
    this.applyFilters()
  }

  applyFilters() {
    this.renderTimeline()
  }

  handleWheel(event) {
    // Allow horizontal scrolling or shift-scroll without zoom
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return
    }

    // Zoom with wheel scroll (no need for Ctrl/Cmd)
    event.preventDefault()

    const rowsRect = this.rowsAreaTarget.getBoundingClientRect()
    const cursorX = event.clientX - rowsRect.left
    const prevPixelsPerDay = this.pixelsPerDay || this.computePixelsPerDay()
    const anchorDay = (this.rowsAreaTarget.scrollLeft + cursorX) / prevPixelsPerDay
    
    // Zoom increment per scroll step
    const zoomStep = 0.05
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep
    let newZoomLevel = this.currentZoomLevel + delta
    
    // Clamp zoom between min and max
    newZoomLevel = Math.max(this.minZoomLevel, Math.min(this.maxZoomLevel, newZoomLevel))
    
    if (Math.abs(newZoomLevel - this.currentZoomLevel) > 0.01) {
      this.currentZoomLevel = newZoomLevel
      this.persistZoomLevel()
      this.renderTimeline()
      const nextPixelsPerDay = this.pixelsPerDay || this.computePixelsPerDay()
      const nextScrollLeft = (anchorDay * nextPixelsPerDay) - cursorX
      this.rowsAreaTarget.scrollLeft = Math.max(0, nextScrollLeft)
    }
  }

  computePixelsPerDay() {
    const timelineRect = this.timelineAreaTarget.getBoundingClientRect()
    const timelineWidth = timelineRect.width || this.timelineAreaTarget.offsetWidth || 800
    const maxZoomOutPixelsPerDay = timelineWidth / this.totalDays
    const maxZoomInPixelsPerDay = timelineWidth / 7
    return maxZoomInPixelsPerDay + (maxZoomOutPixelsPerDay - maxZoomInPixelsPerDay) * this.currentZoomLevel
  }

  renderTimeline() {
    // Get filtered tasks
    const filteredTasks = this.getFilteredTasks()
    console.log('Filtered tasks:', filteredTasks.length)
    
    // Get unique contributors - use all project contributors regardless of tasks
    const contributors = this.getContributors(filteredTasks)
    console.log('Contributors found:', contributors.length, contributors)
    console.log('All project contributors:', this.allProjectContributors)
    
    const layoutByContributor = new Map()
    contributors.forEach(c => {
      layoutByContributor.set(c.id, this.getContributorTimelineLayout(c, filteredTasks))
    })

    this.renderContributors(contributors, layoutByContributor)
    this.renderTimelineGrid(contributors, filteredTasks, layoutByContributor)
    
    // Sync scroll positions after rendering
    setTimeout(() => {
      this.syncScrollPositions()
    }, 100)
  }

  getFilteredTasks() {
    let tasks = [...this.allTasks]
    
    // Apply status filters
    if (this.activeFilters.size > 0) {
      tasks = tasks.filter(t => this.activeFilters.has(t.status))
    }
    
    // Apply my tasks filter
    if (this.myTasksOnly) {
      tasks = tasks.filter(t => {
        const isResponsible = t.responsible_users?.some(u => u.id === this.currentUserId)
        const isAccountable = t.accountable_users?.some(u => u.id === this.currentUserId)
        return isResponsible || isAccountable
      })
    }
    
    return tasks
  }

  getContributors(tasks) {
    // Start with all project contributors
    const contributorMap = new Map()
    
    console.log('getContributors called with:', {
      allProjectContributors: this.allProjectContributors,
      tasksCount: tasks.length
    })
    
    // Add all project contributors first
    if (this.allProjectContributors && Array.isArray(this.allProjectContributors)) {
      this.allProjectContributors.forEach(contributor => {
        if (contributor && contributor.id) {
          contributorMap.set(contributor.id, contributor)
        }
      })
    }
    
    // Also add any contributors from tasks (in case some aren't in project contributors)
    tasks.forEach(task => {
      if (task.responsible_users && Array.isArray(task.responsible_users)) {
        task.responsible_users.forEach(user => {
          if (user && user.id) {
            if (!contributorMap.has(user.id)) {
              contributorMap.set(user.id, user)
            }
          }
        })
      }
      if (task.accountable_users && Array.isArray(task.accountable_users)) {
        task.accountable_users.forEach(user => {
          if (user && user.id) {
            if (!contributorMap.has(user.id)) {
              contributorMap.set(user.id, user)
            }
          }
        })
      }
    })

    const hasUnassignedTasks = tasks.some(task => {
      const responsibleIds = task.responsible_users?.map(u => u.id) || []
      const accountableIds = task.accountable_users?.map(u => u.id) || []
      return responsibleIds.length === 0 && accountableIds.length === 0
    })

    if (hasUnassignedTasks && !contributorMap.has(0)) {
      contributorMap.set(0, { id: 0, name: 'Unassigned' })
    }
    
    const contributors = Array.from(contributorMap.values())
    console.log('Final contributors list:', contributors)
    return contributors.sort((a, b) => {
      const nameA = a.name || ''
      const nameB = b.name || ''
      return nameA.localeCompare(nameB)
    })
  }

  contributorRowMinHeightPx(maxLayer) {
    return Math.max(50, 40 + (maxLayer + 1) * 14)
  }

  tasksForTimelineContributor(contributor, tasks) {
    return (tasks || []).filter(t => {
      if (!t.start_date || !t.end_date) return false
      const responsibleIds = t.responsible_users?.map(u => u.id) || []
      const accountableIds = t.accountable_users?.map(u => u.id) || []
      const hasAssignee = responsibleIds.length > 0 || accountableIds.length > 0
      if (!hasAssignee) {
        return contributor.id === 0
      }
      const isResponsible = responsibleIds.includes(contributor.id)
      const isAccountable = accountableIds.includes(contributor.id)
      return isResponsible || isAccountable
    })
  }

  getContributorTimelineLayout(contributor, tasks) {
    const contributorTasks = this.tasksForTimelineContributor(contributor, tasks)
    const overlapMeta = this.assignOverlapLayers(contributorTasks)
    let maxLayer = 0
    contributorTasks.forEach(task => {
      const m = overlapMeta.get(task.id)
      if (m) maxLayer = Math.max(maxLayer, m.layer)
    })
    return { contributorTasks, overlapMeta, maxLayer }
  }

  renderContributors(contributors, layoutByContributor = null) {
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
      const layout = layoutByContributor?.get(contributor.id)
      const maxLayer = layout?.maxLayer ?? 0
      div.style.minHeight = `${this.contributorRowMinHeightPx(maxLayer)}px`
      list.appendChild(div)
    })
  }

  renderTimelineGrid(contributors, tasks, layoutByContributor = null) {
    // Always render the FULL project timeline (from start to end)
    const visibleStartDate = new Date(this.projectStartDate)
    const visibleEndDate = new Date(this.projectEndDate)
    this.visibleStartDate = new Date(visibleStartDate)
    this.visibleEndDate = new Date(visibleEndDate)
    
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
    this.pixelsPerDay = pixelsPerDay
    
    // Render header for full timeline
    this.renderTimelineHeader(visibleStartDate, visibleEndDate, pixelsPerDay)
    
    this.renderTimelineRows(contributors, tasks, visibleStartDate, visibleEndDate, pixelsPerDay, layoutByContributor)
  }

  renderTimelineHeader(startDate, endDate, pixelsPerDay) {
    const header = this.headerAreaTarget
    header.innerHTML = ''
    this.headerInner = document.createElement('div')
    this.headerInner.className = 'timeline-header-inner'
    
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
    } else if (visibleDays > 14) {
      // Medium zoom - show weeks
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
    this.headerInner.style.width = `${totalWidth}px`
    this.headerInner.style.minWidth = `${totalWidth}px`
    
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
        this.headerInner.appendChild(yearCell)
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
        this.headerInner.appendChild(monthCell)
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    } else if (headerType === 'week') {
      let currentDate = new Date(startDate)
      const dayOfWeek = currentDate.getDay()
      currentDate.setDate(currentDate.getDate() - dayOfWeek)
      
      for (let i = 0; i < cellCount; i++) {
        const weekCell = document.createElement('div')
        weekCell.className = 'timeline-day-header'
        weekCell.style.width = `${cellWidth}px`
        const weekEnd = new Date(currentDate)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const weekOfMonth = this.getWeekOfMonth(currentDate)
        const monthName = currentDate.toLocaleDateString('en-US', { month: 'short' })
        weekCell.textContent = `W${weekOfMonth} ${monthName}`
        weekCell.title = `${currentDate.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
        this.headerInner.appendChild(weekCell)
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
        this.headerInner.appendChild(dayCell)
        
        currentDate.setDate(currentDate.getDate() + 1)
        dayCount++
      }
    }

    header.appendChild(this.headerInner)
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

  getWeekOfMonth(date) {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const firstWeekday = firstOfMonth.getDay()
    return Math.ceil((date.getDate() + firstWeekday) / 7)
  }

  renderTimelineRows(contributors, tasks, startDate, endDate, pixelsPerDay, layoutByContributor = null) {
    const rowsArea = this.rowsAreaTarget
    rowsArea.innerHTML = ''
    this.taskElements = new Map()
    
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    const totalWidth = Math.ceil(days * pixelsPerDay) // Ensure integer pixel width
    
    // Don't set width on rowsArea itself - it should be constrained by parent
    // Instead, each row inside will have the full width, making rowsArea scrollable
    rowsArea.style.width = 'auto'
    rowsArea.style.minWidth = 'auto'
    
    if (contributors.length === 0) {
      // If no contributors, show a message or create rows for all tasks
      console.log('No contributors found, checking tasks:', tasks.length)
    }
    
    contributors.forEach(contributor => {
      const row = document.createElement('div')
      row.className = 'timeline-row'
      row.dataset.contributorId = contributor.id
      
      // Set row width to match timeline width so it extends beyond viewport
      row.style.width = `${totalWidth}px`
      row.style.minWidth = `${totalWidth}px`
      
      const { contributorTasks, overlapMeta, maxLayer } =
        layoutByContributor?.get(contributor.id) || this.getContributorTimelineLayout(contributor, tasks)

      row.style.minHeight = `${this.contributorRowMinHeightPx(maxLayer)}px`

      // Render task bars
      contributorTasks.forEach(task => {
        const taskBar = this.createTaskBar(task, startDate, pixelsPerDay, overlapMeta)
        row.appendChild(taskBar)
        const existing = this.taskElements.get(task.id) || []
        existing.push(taskBar)
        this.taskElements.set(task.id, existing)
      })
      
      this.addRowDragHandlers(row)
      rowsArea.appendChild(row)
    })
  }

  assignOverlapLayers(tasks) {
    const meta = new Map()
    const withDates = (tasks || []).filter(t => t.start_date && t.end_date)
    const sorted = [...withDates].sort(
      (a, b) => this.parseDateString(a.start_date) - this.parseDateString(b.start_date)
    )
    const layerEnds = []
    sorted.forEach(task => {
      const s = this.parseDateString(task.start_date)
      const e = this.parseDateString(task.end_date)
      let layer = 0
      while (layer < layerEnds.length && layerEnds[layer] >= s) layer++
      if (layer === layerEnds.length) layerEnds.push(e)
      else layerEnds[layer] = e

      const overlapNames = []
      withDates.forEach(other => {
        if (other.id === task.id) return
        const os = this.parseDateString(other.start_date)
        const oe = this.parseDateString(other.end_date)
        if (s <= oe && e >= os) overlapNames.push(other.name)
      })
      meta.set(task.id, { layer, overlapNames })
    })
    return meta
  }

  createTaskBar(task, startDate, pixelsPerDay, overlapMeta = new Map()) {
    const bar = document.createElement('div')
    bar.className = `timeline-feature-bar status-${task.status || 'not_started'}`
    bar.dataset.taskId = task.id

    const layerInfo = overlapMeta.get(task.id) || { layer: 0, overlapNames: [] }
    const overlappingNames = layerInfo.overlapNames || []
    
    const taskStart = this.parseDateString(task.start_date)
    const taskEnd = this.parseDateString(task.end_date)
    
    // Calculate position relative to startDate
    const daysFromStart = (taskStart - startDate) / (1000 * 60 * 60 * 24)
    const taskDuration = Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24))
    const durationDays = Math.max(1, taskDuration + 1)
    
    const left = Math.max(0, daysFromStart * pixelsPerDay)
    const width = Math.max(10, durationDays * pixelsPerDay) // Minimum 10px width
    
    bar.style.left = `${left}px`
    bar.style.width = `${width}px`
    const stackTop = 8 + layerInfo.layer * 14
    bar.style.top = `${stackTop}px`
    bar.style.transform = 'none'
    if (overlappingNames.length > 0) {
      bar.classList.add('timeline-task-has-overlap')
    }
    bar.textContent = task.name
    bar.title = overlappingNames.length > 0
      ? `${task.name} (${taskStart.toLocaleDateString()} - ${taskEnd.toLocaleDateString()})\n⚠ Overlaps with: ${overlappingNames.join(', ')}`
      : `${task.name} (${taskStart.toLocaleDateString()} - ${taskEnd.toLocaleDateString()})`
    
    // Make bar clickable (navigate to task show)
    bar.style.cursor = 'pointer'
    bar.addEventListener('click', (e) => {
      e.stopPropagation()
      if (this.suppressTaskClick) {
        this.suppressTaskClick = false
        return
      }
      const pathMatch = window.location.pathname.match(/\/projects\/(\d+)/)
      if (pathMatch && task.id) {
        window.location.href = `/projects/${pathMatch[1]}/tasks/${task.id}`
      }
    })

    bar.addEventListener('mousedown', (e) => this.startTaskMoveHold(e, task))
    bar.addEventListener('mouseup', () => {
      if (this.taskHoldTimer && !this.isTaskDragging) {
        window.clearTimeout(this.taskHoldTimer)
        this.taskHoldTimer = null
      }
    })
    bar.addEventListener('mouseleave', () => {
      if (this.taskHoldTimer && !this.isTaskDragging) {
        window.clearTimeout(this.taskHoldTimer)
        this.taskHoldTimer = null
      }
    })

    const startHandle = document.createElement('div')
    startHandle.className = 'timeline-resize-handle handle-start'
    startHandle.addEventListener('mousedown', (e) => this.beginTaskResize(e, task, 'start'))
    bar.appendChild(startHandle)

    const endHandle = document.createElement('div')
    endHandle.className = 'timeline-resize-handle handle-end'
    endHandle.addEventListener('mousedown', (e) => this.beginTaskResize(e, task, 'end'))
    bar.appendChild(endHandle)

    if (overlappingNames.length > 0) {
      const dot = document.createElement('span')
      dot.className = 'timeline-task-overlap-dot'
      dot.title = 'Tasks overlap in this row — drag to separate.'
      bar.appendChild(dot)
      const warningIcon = document.createElement('span')
      warningIcon.className = 'timeline-task-overlap-warning'
      warningIcon.textContent = '!'
      warningIcon.title = `Overlapping: ${overlappingNames.join(', ')}`
      bar.appendChild(warningIcon)
    }
    
    return bar
  }

  setZoomDay() {
    this.currentZoomLevel = this.minZoomLevel
    this.persistZoomLevel()
    this.renderTimeline()
  }

  setZoomMonth() {
    this.currentZoomLevel = 0.7
    this.persistZoomLevel()
    this.renderTimeline()
  }

  setZoomYear() {
    this.currentZoomLevel = this.maxZoomLevel
    this.persistZoomLevel()
    this.renderTimeline()
  }

  setZoomFit() {
    this.currentZoomLevel = this.maxZoomLevel
    this.persistZoomLevel()
    this.renderTimeline()
  }

  goToProjectStart() {
    if (!this.rowsAreaTarget) return
    this.rowsAreaTarget.scrollLeft = 0
  }

  goToProjectEnd() {
    if (!this.rowsAreaTarget) return
    this.rowsAreaTarget.scrollLeft = this.rowsAreaTarget.scrollWidth - this.rowsAreaTarget.clientWidth
  }

  loadZoomLevel() {
    const key = this.zoomStorageKey()
    if (!key) return
    const saved = parseFloat(localStorage.getItem(key))
    if (!Number.isNaN(saved)) {
      this.currentZoomLevel = Math.max(this.minZoomLevel, Math.min(this.maxZoomLevel, saved))
    }
  }

  persistZoomLevel() {
    const key = this.zoomStorageKey()
    if (!key) return
    localStorage.setItem(key, this.currentZoomLevel.toString())
  }

  zoomStorageKey() {
    if (!this.projectId) return null
    return `project_timeline_zoom_${this.projectId}`
  }

  extractProjectId() {
    const match = window.location.pathname.match(/\/projects\/(\d+)/)
    return match ? match[1] : null
  }

  addRowDragHandlers(row) {
    if (!this.isProjectCreator) return

    let holdTimer = null
    let longPressTriggered = false

    row.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      if (e.target.closest('.timeline-feature-bar')) {
        return
      }

      e.preventDefault()
      e.stopPropagation()

      longPressTriggered = false
      this.hasDragged = false

      holdTimer = window.setTimeout(() => {
        longPressTriggered = true
        this.isDragging = true
        this.dragRow = row
        this.dragStartX = this.getRowOffsetX(e, row)
        this.dragEndX = this.dragStartX
        this.createDragSelection()
        this.updateDragSelection()

        this.mouseMoveHandler = (moveEvent) => {
          if (!this.isDragging) return
          this.hasDragged = true
          this.dragEndX = this.getRowOffsetX(moveEvent, row)
          this.updateDragSelection()
        }

        this.mouseUpHandler = () => {
          if (!this.isDragging) return
          this.isDragging = false
          this.suppressTaskClick = true

          if (this.dragStartX !== null && this.dragEndX !== null) {
            const startOffset = Math.min(this.dragStartX, this.dragEndX)
            const endOffset = Math.max(this.dragStartX, this.dragEndX)
            const startDate = this.getDateFromOffset(startOffset)
            const dayCount = Math.max(1, Math.ceil((endOffset - startOffset) / this.pixelsPerDay))
            const endDate = this.addDays(startDate, dayCount - 1)
            const contributorId = parseInt(row.dataset.contributorId, 10)
            this.openCreateChoiceModal(startDate, endDate, contributorId)
          }

          this.clearDragSelection()

          document.removeEventListener('mousemove', this.mouseMoveHandler)
          document.removeEventListener('mouseup', this.mouseUpHandler)
          this.mouseMoveHandler = null
          this.mouseUpHandler = null
        }

        document.addEventListener('mousemove', this.mouseMoveHandler)
        document.addEventListener('mouseup', this.mouseUpHandler)
      }, this.longPressThreshold)
    })

    row.addEventListener('mouseup', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })

    row.addEventListener('mouseleave', () => {
      if (!longPressTriggered && holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = null
      }
    })
  }

  createDragSelection() {
    if (!this.dragRow) return
    if (!this.dragSelectionEl) {
      this.dragSelectionEl = document.createElement('div')
      this.dragSelectionEl.className = 'timeline-drag-selection'
      this.dragRow.appendChild(this.dragSelectionEl)
    }
  }

  updateDragSelection() {
    if (!this.dragSelectionEl || this.dragStartX === null || this.dragEndX === null) return
    const start = Math.min(this.dragStartX, this.dragEndX)
    const end = Math.max(this.dragStartX, this.dragEndX)
    this.dragSelectionEl.style.left = `${start}px`
    this.dragSelectionEl.style.width = `${Math.max(2, end - start)}px`
  }

  clearDragSelection() {
    if (this.dragSelectionEl) {
      this.dragSelectionEl.remove()
      this.dragSelectionEl = null
    }
    this.dragRow = null
    this.dragStartX = null
    this.dragEndX = null
  }

  getRowOffsetX(event, row) {
    const rowsRect = this.rowsAreaTarget.getBoundingClientRect()
    return event.clientX - rowsRect.left + this.rowsAreaTarget.scrollLeft
  }

  getDateFromOffset(offsetX) {
    const dayOffset = Math.floor(offsetX / this.pixelsPerDay)
    const date = new Date(this.visibleStartDate)
    date.setDate(date.getDate() + dayOffset)
    return date
  }

  addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  openCreateChoiceModal(startDate, endDate, contributorId = null) {
    this.pendingTimelineCreate = { startDate, endDate, contributorId }
    const kindModal = document.getElementById('timelineCreateKindModal')
    if (!kindModal) {
      this.openTaskCreationModal(startDate, endDate, contributorId)
      return
    }
    bootstrap.Modal.getOrCreateInstance(kindModal).show()
  }

  chooseTimelineCreateTask(event) {
    event?.preventDefault()
    const p = this.pendingTimelineCreate
    bootstrap.Modal.getInstance(document.getElementById('timelineCreateKindModal'))?.hide()
    if (!p) return
    this.openTaskCreationModal(p.startDate, p.endDate, p.contributorId)
  }

  chooseTimelineCreateFeature(event) {
    event?.preventDefault()
    const p = this.pendingTimelineCreate
    bootstrap.Modal.getInstance(document.getElementById('timelineCreateKindModal'))?.hide()
    if (!p) return
    this.openFeatureCreateFromTimelineModal(p.startDate, p.endDate, p.contributorId)
  }

  openFeatureCreateFromTimelineModal(startDate, endDate, contributorId) {
    const modal = document.getElementById('timelineFeatureCreateModal')
    if (!modal) return

    const nameInput = modal.querySelector('#timeline_feature_name')
    const templateSelect = modal.querySelector('#timeline_feature_template_id')
    const anchorInput = modal.querySelector('#timeline_feature_anchor_date')
    const tbody = modal.querySelector('#timeline_feature_tasks_tbody')

    if (nameInput) nameInput.value = ''
    if (anchorInput) anchorInput.value = this.formatDateYMD(startDate)

    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">— None (use rows below) —</option>'
      ;(this.featureTemplates || []).forEach(t => {
        const opt = document.createElement('option')
        opt.value = String(t.id)
        opt.textContent = t.name
        templateSelect.appendChild(opt)
      })
    }

    if (tbody) {
      tbody.innerHTML = ''
      const dayCount = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)
      const row = this.buildFeatureTaskRow({
        name: '',
        start_date: this.formatDateYMD(startDate),
        end_date: this.formatDateYMD(this.addDays(startDate, dayCount - 1)),
        responsible_user_id: contributorId && contributorId > 0 ? String(contributorId) : ''
      })
      tbody.appendChild(row)
    }

    modal.dataset.contributorId = contributorId != null ? String(contributorId) : ''
    bootstrap.Modal.getOrCreateInstance(modal).show()
  }

  buildFeatureTaskRow({ name, start_date, end_date, responsible_user_id }) {
    const tr = document.createElement('tr')
    const users = this.userOptionsForFeatureModal()
    tr.innerHTML = `
      <td><input type="text" class="form-control form-control-sm" name="tasks[][name]" value="${this.escapeAttr(name)}" placeholder="Task name"></td>
      <td><input type="date" class="form-control form-control-sm" name="tasks[][start_date]" value="${start_date || ''}"></td>
      <td><input type="date" class="form-control form-control-sm" name="tasks[][end_date]" value="${end_date || ''}"></td>
      <td><select class="form-select form-select-sm" name="tasks[][responsible_user_id]">${users}</select></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger" data-action="click->task-timeline#removeFeatureTaskRow">✕</button></td>
    `
    const sel = tr.querySelector('select[name="tasks[][responsible_user_id]"]')
    if (sel && responsible_user_id) sel.value = String(responsible_user_id)
    return tr
  }

  escapeAttr(s) {
    return this.escapeHtml(s || '').replace(/"/g, '&quot;')
  }

  userOptionsForFeatureModal() {
    let html = '<option value="">Unassigned</option>'
    ;(this.allProjectContributors || []).forEach(u => {
      if (!u.id) return
      const label = (u.name || '') + (u.job ? ` — ${u.job}` : '')
      html += `<option value="${u.id}">${this.escapeHtml(label)}</option>`
    })
    return html
  }

  addFeatureTaskRow() {
    const modal = document.getElementById('timelineFeatureCreateModal')
    const tbody = modal?.querySelector('#timeline_feature_tasks_tbody')
    if (!tbody) return
    tbody.appendChild(this.buildFeatureTaskRow({ name: '', start_date: '', end_date: '', responsible_user_id: '' }))
  }

  removeFeatureTaskRow(event) {
    const tr = event.target.closest('tr')
    const tbody = tr?.parentElement
    if (!tbody || tbody.rows.length <= 1) return
    tr.remove()
  }

  onTimelineFeatureTemplateChange(event) {
    const id = event.target.value
    const modal = document.getElementById('timelineFeatureCreateModal')
    const tbody = modal?.querySelector('#timeline_feature_tasks_tbody')
    const anchorInput = modal?.querySelector('#timeline_feature_anchor_date')
    if (!id || !tbody || !anchorInput?.value) return

    const tmpl = (this.featureTemplates || []).find(t => String(t.id) === String(id))
    if (!tmpl || !tmpl.tasks_data) return

    let d = this.parseDateString(anchorInput.value)
    tbody.innerHTML = ''
    tmpl.tasks_data.forEach(td => {
      const dur = parseInt(td.duration ?? td['duration'], 10) || 1
      const nm = td.name || td['name'] || ''
      if (!nm) return
      const end = this.addDays(d, dur - 1)
      tbody.appendChild(this.buildFeatureTaskRow({
        name: nm,
        start_date: this.formatDateYMD(d),
        end_date: this.formatDateYMD(end),
        responsible_user_id: ''
      }))
      d = this.addDays(end, 1)
    })
  }

  async submitTimelineFeatureCreate(event) {
    event?.preventDefault()
    const modal = document.getElementById('timelineFeatureCreateModal')
    if (!modal) return

    const name = modal.querySelector('#timeline_feature_name')?.value?.trim()
    if (!name) {
      window.alert('Please enter a feature name.')
      return
    }

    const form = modal.querySelector('#timeline_feature_tasks_form')
    const fd = new FormData(form)
    const tasks = []
    const names = fd.getAll('tasks[][name]')
    const starts = fd.getAll('tasks[][start_date]')
    const ends = fd.getAll('tasks[][end_date]')
    const responsibles = fd.getAll('tasks[][responsible_user_id]')
    for (let i = 0; i < names.length; i++) {
      tasks.push({
        name: names[i]?.toString()?.trim(),
        start_date: starts[i]?.toString() || '',
        end_date: ends[i]?.toString() || '',
        responsible_user_id: responsibles[i]?.toString() || ''
      })
    }

    const namedTasks = tasks.filter(t => t.name)
    if (namedTasks.length === 0) {
      window.alert('Please add at least one task for this feature.')
      return
    }

    if (!namedTasks[0].start_date) {
      window.alert('The first task needs a start date because it becomes the feature start date.')
      return
    }

    const assignedWithoutStart = namedTasks.find(t => t.responsible_user_id && !t.start_date)
    if (assignedWithoutStart) {
      window.alert(`Task "${assignedWithoutStart.name}" needs a start date because it is assigned to a responsible user.`)
      return
    }

    const payload = {
      feature_name: name,
      tasks: namedTasks
    }

    const url = `/projects/${this.projectId}/project_features/create_from_timeline`
    const submit = async (body) => {
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        body: JSON.stringify(body)
      })
    }

    let res = await submit(payload)
    let data = {}
    try {
      data = await res.json()
    } catch (e) {
      window.alert('Unexpected server response')
      return
    }

    if (res.status === 409 && data.status === 'overlap_warning') {
      const msg = (data.overlaps || []).join('\n')
      if (window.confirm(`Creating this feature will make some tasks overlap:\n\n${msg}\n\nDo you want to proceed anyway and allow overlaps?`)) {
        res = await submit({ ...payload, proceed_overlaps: 'true' })
        try {
          data = await res.json()
        } catch (e) {
          window.alert('Unexpected server response')
          return
        }
      } else {
        return
      }
    }

    if (!res.ok || data.status !== 'success') {
      window.alert(data.errors?.join?.('\n') || data.message || 'Could not create feature.')
      return
    }

    bootstrap.Modal.getInstance(modal)?.hide()
    window.location.reload()
  }

  openTaskCreationModal(startDate, endDate, contributorId = null) {
    const modalElement = document.getElementById('calendarTaskModal')
    if (!modalElement) return

    const startInput = modalElement.querySelector('#task_start_date')
    const endInput = modalElement.querySelector('#task_end_date')
    const durationInput = modalElement.querySelector('#task_duration')
    const responsibleSelect = modalElement.querySelector('#task_responsible_user_id')

    if (startInput) startInput.value = this.formatDateYMD(startDate)
    if (endInput) endInput.value = this.formatDateYMD(endDate)

    if (durationInput && startInput?.value && endInput?.value) {
      const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
      durationInput.value = duration > 0 ? duration : ''
    }

    if (responsibleSelect && contributorId && contributorId > 0) {
      responsibleSelect.value = String(contributorId)
    }

    const modal = new bootstrap.Modal(modalElement)
    modal.show()
  }

  startTaskMoveHold(event, task) {
    if (event.button !== 0) return
    if (event.target.closest('.timeline-resize-handle')) return

    event.preventDefault()
    event.stopPropagation()

    if (this.taskHoldTimer) {
      window.clearTimeout(this.taskHoldTimer)
    }

    const startX = event.clientX
    this.taskHoldTimer = window.setTimeout(() => {
      this.taskHoldTimer = null
      this.isTaskDragging = true
      const linkedTasks = this.getLinkedTasks(task)
      const originalDates = new Map(
        linkedTasks.map(t => [t.id, { start: t.start_date, end: t.end_date }])
      )
      const sourceContributorId = this.getContributorIdForTask(task)

      this.taskDragState = {
        type: 'move',
        task,
        startX,
        startY: event.clientY,
        sourceContributorId,
        targetContributorId: sourceContributorId,
        linkedTasks,
        originalDates
      }

      this.taskMouseMoveHandler = (e) => this.handleTaskDragMove(e)
      this.taskMouseUpHandler = () => this.finishTaskDrag()

      document.addEventListener('mousemove', this.taskMouseMoveHandler)
      document.addEventListener('mouseup', this.taskMouseUpHandler)
    }, this.longPressThreshold)
  }

  beginTaskResize(event, task, direction) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    this.isTaskResizing = true

    const linkedTasks = this.getLinkedTasks(task)
    const originalDates = new Map(
      linkedTasks.map(t => [t.id, { start: t.start_date, end: t.end_date }])
    )

    this.taskDragState = {
      type: `resize-${direction}`,
      task,
      startX,
      linkedTasks,
      originalDates
    }

    this.taskMouseMoveHandler = (e) => this.handleTaskDragMove(e)
    this.taskMouseUpHandler = () => this.finishTaskDrag()

    document.addEventListener('mousemove', this.taskMouseMoveHandler)
    document.addEventListener('mouseup', this.taskMouseUpHandler)
  }

  handleTaskDragMove(event) {
    if (!this.taskDragState) return
    const deltaX = event.clientX - this.taskDragState.startX
    const dayDelta = Math.round(deltaX / this.pixelsPerDay)

    const { type, task, linkedTasks, originalDates } = this.taskDragState

    if (type === 'move') {
      if (dayDelta !== 0) {
        linkedTasks.forEach(t => {
          const original = originalDates.get(t.id)
          if (!original) return
          t.start_date = this.shiftDateString(original.start, dayDelta)
          t.end_date = this.shiftDateString(original.end, dayDelta)
          this.updateTaskBarsPosition(t)
        })
      }
      this.updateTaskDragRowFromPointer(event, task)
      return
    }

    if (dayDelta === 0) return

    if (type === 'resize-start' || type === 'resize-end') {
      const direction = type === 'resize-start' ? 'start' : 'end'
      const original = originalDates.get(task.id)
      if (!original) return

      const updatedStart = direction === 'start' ? this.shiftDateString(original.start, dayDelta) : original.start
      const updatedEnd = direction === 'end' ? this.shiftDateString(original.end, dayDelta) : original.end

      if (this.compareDateStrings(updatedStart, updatedEnd) <= 0) {
        task.start_date = updatedStart
        task.end_date = updatedEnd
        this.updateTaskBarsPosition(task)
      }

      linkedTasks.forEach(t => {
        if (t.id === task.id) return
        const linkedOriginal = originalDates.get(t.id)
        if (!linkedOriginal) return
        t.start_date = this.shiftDateString(linkedOriginal.start, dayDelta)
        t.end_date = this.shiftDateString(linkedOriginal.end, dayDelta)
        this.updateTaskBarsPosition(t)
      })
    }
  }

  getContributorIdForTask(task) {
    const r = task.responsible_users?.[0]
    if (r) return r.id
    const a = task.accountable_users?.[0]
    if (a) return a.id
    return 0
  }

  findRowFromPoint(clientX, clientY) {
    const rows = this.rowsAreaTarget?.querySelectorAll('.timeline-row')
    if (!rows) return null
    for (const row of rows) {
      const r = row.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return row
    }
    return null
  }

  updateTaskDragRowFromPointer(event, task) {
    if (!this.taskDragState || this.taskDragState.type !== 'move') return
    const row = this.findRowFromPoint(event.clientX, event.clientY)
    let cid = this.taskDragState.sourceContributorId
    if (row?.dataset?.contributorId !== undefined && row.dataset.contributorId !== '') {
      const parsed = parseInt(row.dataset.contributorId, 10)
      if (!Number.isNaN(parsed)) cid = parsed
    }
    this.taskDragState.targetContributorId = cid
    this.repositionTaskBarToRow(task, cid)
  }

  repositionTaskBarToRow(task, contributorId) {
    const row = this.rowsAreaTarget?.querySelector(`.timeline-row[data-contributor-id="${contributorId}"]`)
    if (!row) return
    const els = this.taskElements.get(task.id) || []
    els.forEach(el => row.appendChild(el))
  }

  async finishTaskDrag() {
    if (!this.isTaskDragging && !this.isTaskResizing) return

    document.removeEventListener('mousemove', this.taskMouseMoveHandler)
    document.removeEventListener('mouseup', this.taskMouseUpHandler)
    this.taskMouseMoveHandler = null
    this.taskMouseUpHandler = null

    const dragState = this.taskDragState
    this.isTaskDragging = false
    this.isTaskResizing = false
    this.taskDragState = null
    this.suppressTaskClick = true

    if (!dragState?.linkedTasks) return

    // Only persist the task we actually dragged - the backend handles moving linked tasks
    const taskToPersist = dragState.task
    const saved = await this.persistTaskDates(taskToPersist, dragState)
    if (saved === false) {
      const original = dragState.originalDates.get(taskToPersist.id)
      if (original) {
        taskToPersist.start_date = original.start
        taskToPersist.end_date = original.end
        this.updateTaskBarsPosition(taskToPersist)
      }
      // Revert all other linked tasks that were visually moved
      dragState.linkedTasks.forEach(t => {
        if (t.id !== taskToPersist.id) {
          const orig = dragState.originalDates.get(t.id)
          if (orig) {
            t.start_date = orig.start
            t.end_date = orig.end
            this.updateTaskBarsPosition(t)
          }
        }
      })
    } else if (dragState.type === 'move') {
      this.renderTimeline()
    }
  }

  updateTaskBarsPosition(task) {
    const elements = this.taskElements.get(task.id) || []
    if (elements.length === 0) return
    const taskStart = this.parseDateString(task.start_date)
    const taskEnd = this.parseDateString(task.end_date)
    const daysFromStart = (taskStart - this.visibleStartDate) / (1000 * 60 * 60 * 24)
    const taskDuration = Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24))
    const durationDays = Math.max(1, taskDuration + 1)
    const left = Math.max(0, daysFromStart * this.pixelsPerDay)
    const width = Math.max(10, durationDays * this.pixelsPerDay)

    elements.forEach(el => {
      el.style.left = `${left}px`
      el.style.width = `${width}px`
    })
  }

  getLinkedTasks(task) {
    if (!task?.project_feature_id) return [task]
    return this.allTasks.filter(t => t.project_feature_id === task.project_feature_id)
  }

  shiftDateString(dateString, dayDelta) {
    const date = this.parseDateString(dateString)
    date.setDate(date.getDate() + dayDelta)
    return this.formatDateYMD(date)
  }

  compareDateStrings(a, b) {
    const aDate = this.parseDateString(a)
    const bDate = this.parseDateString(b)
    return aDate - bDate
  }

  parseDateString(dateString) {
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(n => parseInt(n, 10))
    return new Date(year, month - 1, day)
  }

  formatDateYMD(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  async persistTaskDates(task, dragState = null) {
    const projectId = window.location.pathname.match(/\/projects\/(\d+)/)?.[1]
    if (!projectId || !task?.id) return

    const extra = {
      start_date: task.start_date,
      end_date: task.end_date
    }
    if (
      dragState?.type === 'move' &&
      dragState.targetContributorId !== dragState.sourceContributorId
    ) {
      extra.responsible_user_id =
        dragState.targetContributorId === 0 ? '' : String(dragState.targetContributorId)
    }

    try {
      return await this.updateTaskField(projectId, task.id, 'date_range', null, extra)
    } catch (error) {
      console.error('Error updating task dates:', error)
      return false
    }
  }

  /**
   * Show modal to select which linked tasks to move. Returns a Promise that resolves with
   * { selectedIds: number[], cancelled: boolean }
   * @param {{ isForward?: boolean }} options — copy only; server already knows direction
   */
  showLinkedTasksModal(tasks, options = {}) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('linkedTasksShiftModal')
      const listEl = document.getElementById('linkedTasksShiftList')
      const checkAllBtn = document.getElementById('linkedTasksShiftCheckAll')
      const okBtn = document.getElementById('linkedTasksShiftOk')
      const introEl = document.getElementById('linkedTasksShiftIntro')
      if (!modalEl || !listEl || !checkAllBtn || !okBtn) {
        resolve({ selectedIds: [], cancelled: true })
        return
      }

      const directionHint = options.isForward
        ? 'You are moving this task <strong>later</strong> in time.'
        : 'You are moving this task <strong>earlier</strong> in time.'
      if (introEl) {
        introEl.innerHTML = `${directionHint}<br><br><strong>Checked</strong> tasks move by the same amount and stay linked.<br><strong>Unchecked</strong> tasks keep their current dates; the link to this task is removed.<br><strong>Cancel move</strong> means nothing is saved: this task and links stay as before.`
      }

      listEl.innerHTML = ''
      tasks.forEach((t) => {
        const div = document.createElement('div')
        div.className = 'form-check'
        div.innerHTML = `
          <input class="form-check-input" type="checkbox" value="${t.id}" id="linkedTask_${t.id}" checked>
          <label class="form-check-label" for="linkedTask_${t.id}">${this.escapeHtml(t.name || `Task #${t.id}`)}</label>
        `
        listEl.appendChild(div)
      })

      const getSelectedIds = () =>
        Array.from(listEl.querySelectorAll('.form-check-input:checked')).map((cb) => parseInt(cb.value, 10))

      const updateCheckAllLabel = () => {
        const all = listEl.querySelectorAll('.form-check-input')
        const anyUnchecked = Array.from(all).some((cb) => !cb.checked)
        checkAllBtn.textContent = anyUnchecked ? 'Check all' : 'Uncheck all'
      }
      checkAllBtn.onclick = () => {
        const all = listEl.querySelectorAll('.form-check-input')
        const anyUnchecked = Array.from(all).some((cb) => !cb.checked)
        all.forEach((cb) => { cb.checked = anyUnchecked })
        updateCheckAllLabel()
      }
      listEl.addEventListener('change', updateCheckAllLabel)
      updateCheckAllLabel()

      const cleanup = () => {
        modalEl.removeEventListener('hidden.bs.modal', onHidden)
        okBtn.removeEventListener('click', onOk)
        listEl.removeEventListener('change', updateCheckAllLabel)
      }

      const onHidden = () => {
        cleanup()
        resolve({ selectedIds: [], cancelled: true })
      }

      const onOk = () => {
        const selectedIds = getSelectedIds()
        cleanup()
        const modal = bootstrap.Modal.getInstance(modalEl)
        if (modal) modal.hide()
        resolve({ selectedIds, cancelled: false })
      }

      modalEl.addEventListener('hidden.bs.modal', onHidden)
      okBtn.addEventListener('click', onOk)

      const modal = bootstrap.Modal.getOrCreateInstance(modalEl)
      modal.show()
    })
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  async updateTaskField(projectId, taskId, field, value, extra = {}) {
    const payload = { field: field, value: value, ...extra }
    const url = new URL(`/projects/${projectId}/tasks/${taskId}`, window.location.origin)
    if (extra.proceed_linked_overlap) url.searchParams.set('proceed_linked_overlap', extra.proceed_linked_overlap)
    if (extra.link_decision) url.searchParams.set('link_decision', extra.link_decision)
    if (extra.overlap_decision) url.searchParams.set('overlap_decision', extra.overlap_decision)
    if (Array.isArray(extra.task_ids_to_shift)) {
      extra.task_ids_to_shift.forEach((id) => url.searchParams.append('task_ids_to_shift[]', id))
    }
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.status === 409) {
      let data
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (e) {
        console.error('[TaskTimeline] Failed to parse 409 response:', e)
        throw new Error('Invalid response from server')
      }
      if (data.status === 'overlap_warning') {
        const isLinkedShift = data.overlap_context === 'linked_shift'
        let proceed
        if (isLinkedShift) {
          proceed = window.confirm(`${data.message}\n\nOK = Proceed anyway (tasks will overlap)\nCancel = Break the link`)
        } else {
          proceed = window.confirm(`${data.message}\n\nDo you want to proceed anyway?`)
        }
        if (proceed) {
          const overlapFlags = isLinkedShift
            ? { link_decision: 'shift', proceed_linked_overlap: 'true' }
            : { proceed: 'true' }
          return await this.updateTaskField(projectId, taskId, field, value, { ...extra, ...overlapFlags })
        }
        if (isLinkedShift) {
          return await this.updateTaskField(projectId, taskId, field, value, { ...extra, link_decision: 'shift', overlap_decision: 'break' })
        }
        return false
      } else if (data.status === 'linked_shift_warning' || data.status === 'linked_shift_forward_warning') {
        const tasksToMove = data.tasks_to_move || data.linked_tasks || []
        const useCheckboxModal = tasksToMove.length >= 2
        let selectedIds
        let cancelled
        if (useCheckboxModal) {
          const isForward = data.status === 'linked_shift_forward_warning'
          const result = await this.showLinkedTasksModal(tasksToMove, { isForward })
          selectedIds = result.selectedIds
          cancelled = result.cancelled
        } else {
          const msg = data.status === 'linked_shift_forward_warning'
            ? (data.message || 'Move the linked task forward as well?')
            : (data.message || 'Move the linked task back as well?')
          const choice = window.confirm(
            `${msg}\n\n` +
              'OK = Move the linked task with this one (keeps the link).\n' +
              'Cancel = Abort: do not change dates; links stay as they are.'
          )
          selectedIds = choice && tasksToMove.length === 1 ? [tasksToMove[0].id] : []
          cancelled = !choice
        }
        if (cancelled) {
          return false
        }
        const nextExtra = { ...extra, link_decision: 'shift', task_ids_to_shift: selectedIds }
        const result = await this.updateTaskField(projectId, taskId, field, value, nextExtra)
        if (result !== false) return result
        return false
      } else if (data.status === 'project_start_warning') {
        const proceed = window.confirm(`${data.message}\n\nDo you want to proceed anyway?`)
        if (proceed) {
          return this.updateTaskField(projectId, taskId, field, value, { ...extra, proceed_project_start: true })
        }
        return false
      } else if (data.status === 'linked_warning') {
        const align = window.confirm(`${data.message}\n\nOK = Align linked tasks\nCancel = More options`)
        if (align) {
          return this.updateTaskField(projectId, taskId, field, value, { ...extra, link_decision: 'align' })
        }
        const breakLink = window.confirm('Break the link instead?')
        if (breakLink) {
          return this.updateTaskField(projectId, taskId, field, value, { ...extra, link_decision: 'break' })
        }
        return false
      } else {
        console.warn('Unhandled 409 status:', data?.status, 'Full response:', data)
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
    const data = await response.json()
    if ('responsible_user_id' in extra && taskId) {
      const t = this.allTasks.find(x => String(x.id) === String(taskId))
      if (t && data?.responsible_users) {
        t.responsible_users = data.responsible_users
        t.accountable_users = data.accountable_users || t.accountable_users
      }
    }
    if (data?.linked_updates && Array.isArray(data.linked_updates) && data.linked_updates.length > 0) {
      data.linked_updates.forEach(update => {
        const task = this.allTasks.find(t => String(t.id) === String(update.id))
        if (task) {
          task.start_date = update.start_date
          task.end_date = update.end_date
        }
      })
      this.renderTimeline()
    }
    if (data?.linked_notice) {
      alert(data.linked_notice)
    }
    return true
  }

  syncScrollPositions() {
    // Remove old listeners if they exist
    const headerArea = this.headerAreaTarget
    const rowsArea = this.rowsAreaTarget
    const contributorsList = this.contributorsListTarget
    
    if (this.scrollHandlers.rowsScrollHandler && rowsArea) {
      rowsArea.removeEventListener('scroll', this.scrollHandlers.rowsScrollHandler)
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
        if (this.headerInner) {
          this.headerInner.style.transform = `translateX(${-rowsArea.scrollLeft}px)`
        }
      }
      this.scrollHandlers.headerScroll = () => {}
      
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
      this.scrollHandlers.rowsScrollHandler = () => {
        this.scrollHandlers.rowsHorizontalScroll()
        if (contributorsList && this.scrollHandlers.rowsVerticalScroll) {
          this.scrollHandlers.rowsVerticalScroll()
        }
        this.persistScrollPositions()
      }
      
      rowsArea.addEventListener('scroll', this.scrollHandlers.rowsScrollHandler)
      headerArea.removeEventListener('scroll', this.scrollHandlers.headerScroll)
      
      if (contributorsList) {
        contributorsList.addEventListener('scroll', this.scrollHandlers.contributorsScroll)
      }

      // Restore scroll position and align header
      const saved = this.loadScrollPositions()
      if (saved) {
        if (typeof saved.left === 'number') {
          rowsArea.scrollLeft = saved.left
        }
        if (typeof saved.top === 'number') {
          rowsArea.scrollTop = saved.top
        }
      }
      if (this.headerInner) {
        this.headerInner.style.transform = `translateX(${-rowsArea.scrollLeft}px)`
      }
    }
  }

  persistScrollPositions() {
    const key = this.scrollStorageKey()
    if (!key) return
    const payload = {
      left: this.rowsAreaTarget.scrollLeft,
      top: this.rowsAreaTarget.scrollTop
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }

  loadScrollPositions() {
    const key = this.scrollStorageKey()
    if (!key) return null
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      return saved
    } catch (e) {
      return null
    }
  }

  scrollStorageKey() {
    if (!this.projectId) return null
    return `project_timeline_scroll_${this.projectId}`
  }

  persistTimelineState() {
    const key = this.stateStorageKey()
    if (!key) return
    const payload = {
      myTasksOnly: this.myTasksOnly
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }

  loadTimelineState() {
    const key = this.stateStorageKey()
    if (!key) return
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      if (typeof saved?.myTasksOnly === 'boolean') {
        this.myTasksOnly = saved.myTasksOnly
      }
    } catch (e) {
      // ignore
    }
  }

  updateMyTasksToggle() {
    if (!this.hasMyTasksToggleTarget) return
    if (this.myTasksOnly) {
      this.myTasksToggleTarget.classList.add('active')
      this.myTasksToggleTarget.textContent = 'Show All'
    } else {
      this.myTasksToggleTarget.classList.remove('active')
      this.myTasksToggleTarget.textContent = 'My Tasks Only'
    }
  }

  stateStorageKey() {
    if (!this.projectId) return null
    return `project_timeline_state_${this.projectId}`
  }
}

