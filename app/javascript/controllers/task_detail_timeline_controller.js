import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["card", "controls", "rangeInfo", "nameInput", "colorInput", "templateButton"]
  static values = {
    projectId: Number,
    taskId: Number,
    duration: Number,
    canEdit: Boolean,
    templateApplied: Boolean,
    startDate: String,
    endDate: String,
    taskName: String,
    taskStatus: String,
    segments: String,
    checkpoints: String
  }

  connect() {
    this.isSelecting = false
    this.startDay = null
    this.endDay = null
    this.selectedDays = new Set()
    this.segmentsData = this.parseJsonValue(this.segmentsValue, [])
    this.checkpointsData = this.parseJsonValue(this.checkpointsValue, [])
    this.taskNameValue = this.taskNameValue || ''
    this.taskStatusValue = this.taskStatusValue || 'not_started'

    setTimeout(() => this.adjustSegmentWidths(), 100)
    window.addEventListener('resize', () => this.adjustSegmentWidths())
    this.rebuildTimeline()
    this.updateTemplateButtonState()

    this.onTaskDateUpdated = (event) => {
      const { start_date, end_date } = event.detail || {}
      if (!start_date || !end_date) return
      this.startDateValue = start_date
      this.endDateValue = end_date
    this.rebuildTimeline()
    this.updateTemplateButtonState()
    }
    document.addEventListener('task:date-updated', this.onTaskDateUpdated)

    this.onSegmentsUpdated = (event) => {
      const { segments, checkpoints } = event.detail || {}
      if (segments) {
        this.segmentsData = segments
      }
      if (checkpoints) {
        this.checkpointsData = checkpoints
      }
      this.rebuildTimeline()
    }
    document.addEventListener('task:segments-updated', this.onSegmentsUpdated)
  }

  disconnect() {
    window.removeEventListener('resize', () => this.adjustSegmentWidths())
    if (this.onTaskDateUpdated) {
      document.removeEventListener('task:date-updated', this.onTaskDateUpdated)
    }
    if (this.onSegmentsUpdated) {
      document.removeEventListener('task:segments-updated', this.onSegmentsUpdated)
    }
  }

  adjustSegmentWidths() {
    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return

    const overlays = this.cardTarget.querySelectorAll('.timeline-segment-overlay:not(.timeline-task-overlay)')
    overlays.forEach(overlay => {
      const startDay = parseFloat(overlay.dataset.startDay)
      const endDay = parseFloat(overlay.dataset.endDay)
      if (Number.isNaN(startDay) || Number.isNaN(endDay)) return
      const startIndex = Math.ceil(startDay)
      const endIndex = Math.floor(endDay)

      const startWrapper = container.querySelector(`.timeline-day-cell-wrapper:nth-child(${startIndex * 2 - 1})`)
      const endWrapper = container.querySelector(`.timeline-day-cell-wrapper:nth-child(${endIndex * 2 - 1})`)
      if (!startWrapper || !endWrapper) return

      const startCell = startWrapper.querySelector('.timeline-day-cell')
      const endCell = endWrapper.querySelector('.timeline-day-cell')
      const gap = container.querySelector('.timeline-day-gap')
      if (!startCell || !endCell) return

      const dayWidth = startCell.getBoundingClientRect().width
      const gapWidth = gap ? gap.getBoundingClientRect().width : 0
      const unit = dayWidth + gapWidth

      const startFraction = startDay - startIndex
      const endFraction = endDay - endIndex

      const left = startCell.offsetLeft + (startFraction * unit)
      const right = endCell.offsetLeft + dayWidth + (endFraction * unit)
      const width = Math.max(0, right - left)

      overlay.style.left = `${left}px`
      overlay.style.width = `${width}px`
    })
  }

  updateTemplateButtonState() {
    if (!this.hasTemplateButtonTarget) return
    if (this.templateAppliedValue) {
      this.templateButtonTarget.disabled = true
      this.templateButtonTarget.classList.add('disabled')
    } else {
      this.templateButtonTarget.disabled = false
      this.templateButtonTarget.classList.remove('disabled')
    }
  }

  markTemplateDirty() {
    this.templateAppliedValue = false
    this.updateTemplateButtonState()
  }

  startSelection(event) {
    if (!this.canEditValue) return
    if (this.resizing) return
    if (event.currentTarget.classList.contains('segment-day')) {
      return
    }

    event.preventDefault()
    this.isSelecting = true
    const day = parseInt(event.currentTarget.dataset.day)
    this.startDay = day
    this.endDay = day
    this.selectedDays.clear()
    this.selectedDays.add(day)
    this.updateVisualSelection()
    this.showControls()
  }

  updateSelection(event) {
    if (!this.isSelecting || !this.canEditValue) return
    if (this.resizing) return
    if (event.currentTarget.classList.contains('segment-day')) {
      return
    }

    const day = parseInt(event.currentTarget.dataset.day)
    this.endDay = day

    const start = Math.min(this.startDay, this.endDay)
    const end = Math.max(this.startDay, this.endDay)

    this.selectedDays.clear()
    for (let d = start; d <= end; d++) {
      const cell = this.cardTarget.querySelector(`.timeline-day-cell[data-day="${d}"]`)
      if (cell && !cell.classList.contains('segment-day')) {
        this.selectedDays.add(d)
      }
    }

    this.updateVisualSelection()
    if (this.selectedDays.size > 0) {
      const actualStart = Math.min(...Array.from(this.selectedDays))
      const actualEnd = Math.max(...Array.from(this.selectedDays))
      this.updateRangeInfo(actualStart, actualEnd)
    }
  }

  endSelection(event) {
    if (!this.isSelecting) return

    this.isSelecting = false
    event.preventDefault()
    event.stopPropagation()
  }

  updateVisualSelection() {
    this.cardTarget.querySelectorAll('.timeline-day-cell').forEach(cell => {
      cell.classList.remove('selected')
    })

    this.selectedDays.forEach(day => {
      const cell = this.cardTarget.querySelector(`.timeline-day-cell[data-day="${day}"]`)
      if (cell) {
        cell.classList.add('selected')
      }
    })
  }

  updateRangeInfo(start, end) {
    const dayCount = end - start + 1
    this.rangeInfoTarget.textContent = `Selected: Day ${start} to Day ${end} (${dayCount} day${dayCount > 1 ? 's' : ''})`
  }

  showControls() {
    if (this.selectedDays.size > 0) {
      const start = Math.min(...Array.from(this.selectedDays))
      const end = Math.max(...Array.from(this.selectedDays))
      this.updateRangeInfo(start, end)
      this.controlsTarget.style.display = 'block'
      this.nameInputTarget.focus()
    }
  }

  hideControls() {
    this.controlsTarget.style.display = 'none'
    this.nameInputTarget.value = ''
    this.selectedDays.clear()
    this.updateVisualSelection()
  }

  cancelSelection() {
    this.hideControls()
    this.startDay = null
    this.endDay = null
  }

  handleNameInput(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      this.saveSegment()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.cancelSelection()
    }
  }

  async saveSegment() {
    if (this.selectedDays.size === 0) return

    const name = this.nameInputTarget.value.trim()
    if (!name) {
      alert('Please enter a segment name')
      return
    }

    const lockedDays = []
    this.selectedDays.forEach(day => {
      const cell = this.cardTarget.querySelector(`.timeline-day-cell[data-day="${day}"]`)
      if (cell && cell.classList.contains('segment-day')) {
        lockedDays.push(day)
      }
    })

    if (lockedDays.length > 0) {
      alert('Cannot create segment: Some selected days are already part of another segment. Please delete the existing segment first.')
      return
    }

    const start = Math.min(...Array.from(this.selectedDays))
    const end = Math.max(...Array.from(this.selectedDays))

    const formData = new FormData()
    formData.append('task_segment[name]', name)
    formData.append('task_segment[start_day]', start)
    formData.append('task_segment[end_day]', end)
    if (this.hasColorInputTarget && this.colorInputTarget.value) {
      formData.append('task_segment[color]', this.colorInputTarget.value)
    }

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_segments`,
        {
          method: 'POST',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          },
          body: formData
        }
      )

      const data = await response.json()

      if (data.status === 'success') {
        const created = data.segment
        this.segmentsData.push({
          id: created.id,
          name: created.name,
          start_day: created.start_day,
          end_day: created.end_day,
          color: created.color || (this.hasColorInputTarget ? this.colorInputTarget.value : null),
          default_percent: created.default_percent,
          percent_flagged: created.percent_flagged
        })
        this.markTemplateDirty()
        this.cancelSelection()
        this.rebuildTimeline()
      } else {
        alert('Error: ' + (data.errors || ['Failed to save segment']).join(', '))
      }
    } catch (error) {
      console.error('Error saving segment:', error)
      alert('An error occurred while saving the segment')
    }
  }

  addCheckpointAtGap(event) {
    event.stopPropagation()
    if (event.target.closest('.timeline-checkpoint')) return
    const day = parseInt(event.currentTarget.dataset.day)
    const name = window.prompt(`Checkpoint name (optional)\n\nThis checkpoint will be placed at the end of day ${day}.`, '')
    if (name === null) return
    this.createCheckpoint(day, name)
  }

  async addCheckpoint() {
    if (this.selectedDays.size === 0) {
      alert('Please select at least one day for the checkpoint')
      return
    }

    const day = Math.max(...Array.from(this.selectedDays))
    this.createCheckpoint(day, '')
  }

  async createCheckpoint(day, name = '') {
    const formData = new FormData()
    formData.append('task_checkpoint[day]', day.toString())
    if (name && name.trim() !== '') {
      formData.append('task_checkpoint[name]', name.trim())
    }

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_checkpoints`,
        {
          method: 'POST',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          },
          body: formData
        }
      )

    const responseText = await response.text()
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error('Failed to parse response as JSON:', e)
        alert('Error: Server returned an invalid response. Status: ' + response.status)
        console.error('Response text:', responseText)
        return
      }

      if (data.status === 'success') {
        this.checkpointsData.push({
          id: data.checkpoint.id,
          day: data.checkpoint.day,
          name: data.checkpoint.name || name
        })
        this.rebuildTimeline()
      } else {
        const errorMessage = data.errors ? data.errors.join(', ') : 'Failed to add checkpoint'
        alert('Error: ' + errorMessage)
        console.error('Checkpoint creation error:', data)
      }
    } catch (error) {
      console.error('Error adding checkpoint:', error)
      alert('An error occurred while adding the checkpoint: ' + error.message)
    }
  }

  async deleteSegment(event) {
    event.stopPropagation()

    if (!confirm('Are you sure you want to delete this segment?')) {
      return
    }

    const segmentId = event.currentTarget.dataset.segmentId

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_segments/${segmentId}`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          }
        }
      )

      const data = await response.json()

      if (data.status === 'success') {
        this.segmentsData = this.segmentsData.filter(s => s.id !== parseInt(segmentId, 10))
        this.markTemplateDirty()
        this.rebuildTimeline()
      } else {
        alert('Error: ' + (data.errors || ['Failed to delete segment']).join(', '))
      }
    } catch (error) {
      console.error('Error deleting segment:', error)
      alert('An error occurred while deleting the segment')
    }
  }

  async deleteCheckpoint(event) {
    event.stopPropagation()

    if (!confirm('Are you sure you want to delete this checkpoint?')) {
      return
    }

    const checkpointId = event.currentTarget.dataset.checkpointId

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_checkpoints/${checkpointId}`,
        {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          }
        }
      )

      const data = await response.json()

      if (data.status === 'success') {
        this.checkpointsData = this.checkpointsData.filter(c => c.id !== parseInt(checkpointId, 10))
        this.rebuildTimeline()
      } else {
        alert('Error: ' + (data.errors || ['Failed to delete checkpoint']).join(', '))
      }
    } catch (error) {
      console.error('Error deleting checkpoint:', error)
      alert('An error occurred while deleting the checkpoint')
    }
  }

  async applyDefaultTemplate(event) {
    event.preventDefault()
    if (!this.canEditValue) return
    if (this.hasTemplateButtonTarget && this.templateButtonTarget.disabled) return
    const confirmApply = window.confirm('Apply the default segmentation template? This will replace existing segments and checkpoints.')
    if (!confirmApply) return

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/apply_default_template`,
        {
          method: 'POST',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          }
        }
      )
      const data = await response.json()
      if (data.status === 'success') {
        window.location.reload()
      } else {
        alert('Error: ' + (data.errors || ['Failed to apply template']).join(', '))
      }
    } catch (error) {
      console.error('Error applying template:', error)
      alert('An error occurred while applying the template')
    }
  }

  async startCheckpointRename(event) {
    event.stopPropagation()
    if (!this.canEditValue) return

    const checkpointId = event.currentTarget.dataset.checkpointId
    const currentName = event.currentTarget.dataset.checkpointName || ''
    const newName = window.prompt('Edit checkpoint name', currentName)
    if (newName === null) return

    const formData = new FormData()
    formData.append('task_checkpoint[name]', newName.trim())

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_checkpoints/${checkpointId}`,
        {
          method: 'PATCH',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          },
          body: formData
        }
      )

      const data = await response.json()
      if (data.status === 'success') {
        this.checkpointsData = this.checkpointsData.map(c => {
          if (c.id === parseInt(checkpointId, 10)) {
            return { ...c, name: data.checkpoint.name }
          }
          return c
        })
        this.rebuildTimeline()
      } else {
        alert('Error: ' + (data.errors || ['Failed to update checkpoint']).join(', '))
      }
    } catch (error) {
      console.error('Error updating checkpoint:', error)
      alert('An error occurred while updating the checkpoint')
    }
  }

  ignoreCheckpointClick(event) {
    event.stopPropagation()
  }

  rebuildTimeline() {
    if (!this.startDateValue || !this.endDateValue) return
    const startDate = this.parseDateString(this.startDateValue)
    const endDate = this.parseDateString(this.endDateValue)
    const duration = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)
    this.durationValue = duration

    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return
    container.innerHTML = ''
    this.selectedDays.clear()

    for (let day = 1; day <= duration; day += 1) {
      const segment = this.segmentsData.find(s => (day + 1) > parseFloat(s.start_day) && day <= parseFloat(s.end_day))
      const isFirstSegmentDay = segment && day === Math.ceil(parseFloat(segment.start_day))
      const dateLabel = new Date(startDate)
      dateLabel.setDate(startDate.getDate() + (day - 1))

      const wrapper = document.createElement('div')
      wrapper.className = 'timeline-day-cell-wrapper'

      const number = document.createElement('div')
      number.className = 'timeline-day-number'
      number.innerHTML = `${day}<span class="day-date">${this.formatDateMMDD(dateLabel)}</span>`
      wrapper.appendChild(number)

      const cell = document.createElement('div')
      cell.className = `timeline-day-cell${segment ? ' segment-day' : ''}${isFirstSegmentDay ? ' segment-day-first' : ''}`
      cell.dataset.day = day
      cell.dataset.date = this.formatDateYMD(dateLabel)
      if (this.canEditValue) {
        cell.addEventListener('mousedown', (e) => this.startSelection(e))
        cell.addEventListener('mouseover', (e) => this.updateSelection(e))
        cell.addEventListener('mouseup', (e) => this.endSelection(e))
      }
      wrapper.appendChild(cell)
      container.appendChild(wrapper)

      if (day < duration) {
        const gap = document.createElement('div')
        gap.className = 'timeline-day-gap'
        gap.dataset.day = day
        const checkpoint = this.checkpointsData.find(c => c.day === day)
        if (checkpoint) {
          const checkpointEl = document.createElement('div')
          checkpointEl.className = 'timeline-checkpoint'
          checkpointEl.dataset.checkpointId = checkpoint.id
          checkpointEl.dataset.day = checkpoint.day
          if (checkpoint.name) {
            const label = document.createElement('div')
            label.className = 'checkpoint-label'
            label.textContent = checkpoint.name
            label.dataset.checkpointId = checkpoint.id
            label.dataset.checkpointName = checkpoint.name
            label.addEventListener('click', (e) => this.startCheckpointRename(e))
            checkpointEl.appendChild(label)
          }
          if (this.canEditValue) {
            const del = document.createElement('button')
            del.className = 'checkpoint-delete-btn'
            del.dataset.checkpointId = checkpoint.id
            del.addEventListener('click', (e) => this.deleteCheckpoint(e))
            del.innerHTML = '<i class="bi bi-x"></i>'
            checkpointEl.appendChild(del)
          }
          gap.appendChild(checkpointEl)
        } else if (this.canEditValue) {
          const placeholder = document.createElement('div')
          placeholder.className = 'checkpoint-placeholder'
          placeholder.addEventListener('click', (e) => this.addCheckpointAtGap(e))
          placeholder.innerHTML = '<i class="bi bi-plus-circle"></i>'
          gap.appendChild(placeholder)
        }
        container.appendChild(gap)
      }
    }

    this.segmentsData.forEach(segment => {
      if (parseFloat(segment.start_day) > duration) return
      const segmentDays = Math.max(0.5, parseFloat(segment.end_day) - parseFloat(segment.start_day) + 1)
      const startPercent = ((parseFloat(segment.start_day) - 1) / duration) * 100
      const startGap = (parseFloat(segment.start_day) - 1) * 8
      const widthPercent = (segmentDays / duration) * 100
      const widthGap = (segmentDays - 1) * 8
      const actualPercent = this.calculatePercent(segmentDays, duration)
      const defaultPercent = this.getDefaultPercent(segment, actualPercent)
      const flagged = this.isPercentFlagged(segment, actualPercent, defaultPercent)
      const overlay = document.createElement('div')
      overlay.className = 'timeline-segment-overlay'
      overlay.dataset.segmentId = segment.id
      overlay.dataset.startDay = segment.start_day
      overlay.dataset.endDay = segment.end_day
      overlay.dataset.duration = duration
      overlay.dataset.defaultPercent = defaultPercent
      overlay.dataset.percentFlagged = flagged
      overlay.style.setProperty('--segment-start-percent', `${startPercent}%`)
      overlay.style.setProperty('--segment-start-gap', `${startGap}px`)
      overlay.style.setProperty('--segment-width-percent', `${widthPercent}%`)
      overlay.style.setProperty('--segment-width-gap', `${widthGap}px`)
      const color = segment.color || '#7c3aed'
      overlay.style.background = color
      const displayPercent = this.formatPercent(defaultPercent)
      const actualPercentText = this.formatPercent(actualPercent)
      const tooltip = flagged
        ? `The original value is ${displayPercent}% but new task time is not dividable to have ${displayPercent}% time segment. Current segment time adjusted to ${actualPercentText}%`
        : ''
      overlay.innerHTML = `
        <div class="segment-content">
          <span class="segment-name">${segment.name}</span>
          <span class="segment-percent${flagged ? ' flagged' : ''}" ${tooltip ? `title="${tooltip}" data-tooltip="${tooltip}"` : ''}>${displayPercent}%</span>
          ${this.canEditValue ? `<button class="segment-delete-btn" data-segment-id="${segment.id}"><i class="bi bi-x"></i></button>` : ''}
        </div>
        ${this.canEditValue ? `<span class="segment-resize-handle left" data-segment-id="${segment.id}" data-handle="start"></span><span class="segment-resize-handle right" data-segment-id="${segment.id}" data-handle="end"></span>` : ''}
      `
      if (tooltip) {
        overlay.setAttribute('title', tooltip)
      } else {
        overlay.removeAttribute('title')
      }
      if (this.canEditValue) {
        const deleteBtn = overlay.querySelector('.segment-delete-btn')
        deleteBtn.addEventListener('click', (e) => this.deleteSegment(e))
        const handles = overlay.querySelectorAll('.segment-resize-handle')
        handles.forEach(handle => {
          handle.addEventListener('mousedown', (e) => this.startResize(e))
        })
      }
      container.appendChild(overlay)
    })

    this.adjustSegmentWidths()
  }

  renderSegmentHandles() {
    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return
    container.querySelectorAll('.segment-boundary-handle, .segment-edge-handle').forEach(el => el.remove())
  }

  startResize(event) {
    if (!this.canEditValue) return
    if (this.resizing) return
    event.preventDefault()
    event.stopPropagation()
    const segmentId = parseInt(event.currentTarget.dataset.segmentId, 10)
    const handle = event.currentTarget.dataset.handle
    if (!segmentId || !handle) return
    this.resizing = { segmentId, handle }
    this.onResizeMove = (e) => this.handleResizeMove(e)
    this.onResizeEnd = (e) => this.handleResizeEnd(e)
    window.addEventListener('mousemove', this.onResizeMove)
    window.addEventListener('mouseup', this.onResizeEnd)
  }

  handleResizeMove(event) {
    if (!this.resizing) return
    const { segmentId, handle } = this.resizing
    const segment = this.segmentsData.find(s => parseInt(s.id, 10) === segmentId)
    if (!segment) return
    const duration = this.durationValue || parseInt(segment.duration, 10) || 1
    const newDay = this.getClosestDay(event.clientX, duration)
    if (!newDay) return

    const sorted = [...this.segmentsData].sort((a, b) => parseFloat(a.start_day) - parseFloat(b.start_day))
    const index = sorted.findIndex(s => parseInt(s.id, 10) === segmentId)
    const prev = index > 0 ? sorted[index - 1] : null
    const next = index < sorted.length - 1 ? sorted[index + 1] : null

    if (handle === 'start') {
      const minStart = prev ? (parseFloat(prev.end_day) + 1) : 1.0
      const maxStart = parseFloat(segment.end_day)
      const clamped = this.clampDay(newDay, minStart, maxStart)
      segment.start_day = clamped
      this.updateOverlayForSegment(segment, duration)
    } else {
      const minEnd = parseFloat(segment.start_day)
      const maxEnd = next ? (parseFloat(next.start_day) - 1) : duration
      const clamped = this.clampDay(newDay, minEnd, maxEnd)
      segment.end_day = clamped
      this.updateOverlayForSegment(segment, duration)
    }
  }

  async handleResizeEnd() {
    if (!this.resizing) return
    const { segmentId, handle } = this.resizing
    const duration = this.durationValue || 1
    const segment = this.segmentsData.find(s => parseInt(s.id, 10) === segmentId)

    const segmentsToUpdate = [segment]

    for (const seg of segmentsToUpdate) {
      if (!seg) continue
      const actual = this.calculatePercent(
        Math.max(0.5, parseFloat(seg.end_day) - parseFloat(seg.start_day) + 1),
        duration
      )
      const defaultPercent = this.getDefaultPercent(seg, actual)
      if (seg.percent_flagged) {
        const displayActual = this.formatPercent(actual)
        const displayDefault = this.formatPercent(defaultPercent)
        const adjustDefault = window.confirm(
          `With this adjustment the subtask is now ${displayActual}%.\n\nOK = Change default to ${displayActual}%\nCancel = Keep default at ${displayDefault}%`
        )
        if (adjustDefault) {
          seg.default_percent = actual
          seg.percent_flagged = false
        } else {
          seg.default_percent = defaultPercent
          seg.percent_flagged = true
        }
      } else {
        seg.default_percent = actual
        seg.percent_flagged = false
      }
    }

    await Promise.all(
      segmentsToUpdate.filter(Boolean).map(seg => this.persistSegmentResize(seg))
    )
    this.rebuildTimeline()

    window.removeEventListener('mousemove', this.onResizeMove)
    window.removeEventListener('mouseup', this.onResizeEnd)
    this.resizing = null
  }

  async persistSegmentResize(segment) {
    try {
      const formData = new FormData()
      formData.append('task_segment[start_day]', segment.start_day)
      formData.append('task_segment[end_day]', segment.end_day)
      if (segment.default_percent !== undefined && segment.default_percent !== null) {
        formData.append('task_segment[default_percent]', segment.default_percent)
      }
      if (segment.percent_flagged !== undefined && segment.percent_flagged !== null) {
        formData.append('task_segment[percent_flagged]', segment.percent_flagged)
      }
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_segments/${segment.id}`,
        {
          method: 'PATCH',
          headers: {
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
            'Accept': 'application/json'
          },
          body: formData
        }
      )
      const data = await response.json()
      if (data.status === 'success') {
        const updated = data.segment
        const target = this.segmentsData.find(s => parseInt(s.id, 10) === segment.id)
        if (target) {
          target.start_day = updated.start_day
          target.end_day = updated.end_day
          target.color = updated.color
          target.default_percent = updated.default_percent
          target.percent_flagged = updated.percent_flagged
        }
      } else {
        alert('Error: ' + (data.errors || ['Failed to update segment']).join(', '))
      }
    } catch (error) {
      console.error('Error updating segment:', error)
      alert('An error occurred while updating the segment')
    }
  }

  updateOverlayForSegment(segment, duration) {
    const overlay = this.cardTarget.querySelector(`.timeline-segment-overlay[data-segment-id="${segment.id}"]`)
    if (!overlay) return
    overlay.dataset.startDay = segment.start_day
    overlay.dataset.endDay = segment.end_day
    const segmentDays = Math.max(0.5, parseFloat(segment.end_day) - parseFloat(segment.start_day) + 1)
    const actualPercent = this.calculatePercent(segmentDays, duration)
    const defaultPercent = this.getDefaultPercent(segment, actualPercent)
    const flagged = this.isPercentFlagged(segment, actualPercent, defaultPercent)
    const percentEl = overlay.querySelector('.segment-percent')
    if (percentEl) {
      percentEl.textContent = `${this.formatPercent(defaultPercent)}%`
      percentEl.classList.toggle('flagged', flagged)
      if (flagged) {
        const tooltip = `The original value is ${this.formatPercent(defaultPercent)}% but new task time is not dividable to have ${this.formatPercent(defaultPercent)}% time segment. Current segment time adjusted to ${this.formatPercent(actualPercent)}%`
        percentEl.title = tooltip
          percentEl.dataset.tooltip = tooltip
        overlay.setAttribute('title', tooltip)
      } else {
        percentEl.removeAttribute('title')
          delete percentEl.dataset.tooltip
        overlay.removeAttribute('title')
      }
    }
    this.adjustSegmentWidths()
  }

  calculatePercent(segmentDays, duration) {
    if (duration <= 0) return 0
    return Math.round((segmentDays / duration) * 100 * 10) / 10
  }

  getDefaultPercent(segment, actualPercent) {
    if (segment.default_percent !== undefined && segment.default_percent !== null) {
      return parseFloat(segment.default_percent)
    }
    return actualPercent
  }

  isPercentFlagged(segment, actualPercent, defaultPercent) {
    if (segment.percent_flagged === true || segment.percent_flagged === 'true') return true
    if (segment.default_percent === undefined || segment.default_percent === null) return false
    return Math.round(defaultPercent * 10) / 10 !== Math.round(actualPercent * 10) / 10
  }

  formatPercent(value) {
    const rounded = Math.round(value * 10) / 10
    return rounded % 1 === 0 ? `${rounded.toFixed(0)}` : `${rounded.toFixed(1)}`
  }

  getClosestDay(clientX, duration) {
    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return null
    const firstCell = container.querySelector('.timeline-day-cell')
    if (!firstCell) return null
    const gap = container.querySelector('.timeline-day-gap')
    const dayWidth = firstCell.getBoundingClientRect().width
    const gapWidth = gap ? gap.getBoundingClientRect().width : 0
    const unit = dayWidth + gapWidth
    const rect = container.getBoundingClientRect()
    const offset = clientX - rect.left
    const raw = (offset / unit) + 1
    const clamped = Math.max(1, Math.min(duration, raw))
    return this.clampDay(clamped, 1, duration)
  }

  getLeftForDay(dayValue) {
    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return 0
    const cell = container.querySelector('.timeline-day-cell')
    const gap = container.querySelector('.timeline-day-gap')
    if (!cell) return 0
    const dayWidth = cell.getBoundingClientRect().width
    const gapWidth = gap ? gap.getBoundingClientRect().width : 0
    const unit = dayWidth + gapWidth
    const dayIndex = Math.floor(dayValue)
    const startWrapper = container.querySelector(`.timeline-day-cell-wrapper:nth-child(${dayIndex * 2 - 1})`)
    if (!startWrapper) return 0
    const startCell = startWrapper.querySelector('.timeline-day-cell')
    if (!startCell) return 0
    const fraction = dayValue - dayIndex
    return startCell.offsetLeft + (fraction * unit)
  }

  clampDay(value, min, max) {
    const rounded = Math.round(value)
    return Math.max(min, Math.min(max, rounded))
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

  formatDateMMDD(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  parseJsonValue(value, fallback) {
    try {
      return JSON.parse(value || '') || fallback
    } catch (e) {
      return fallback
    }
  }
}

