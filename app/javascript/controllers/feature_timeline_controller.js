import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["card", "controls", "rangeInfo", "nameInput"]
  static values = {
    projectId: Number,
    featureId: Number,
    duration: Number,
    canEdit: Boolean
  }

  connect() {
    this.isSelecting = false
    this.startDay = null
    this.endDay = null
    this.selectedDays = new Set()
    
    // Adjust segment widths after page loads and on resize
    setTimeout(() => this.adjustSegmentWidths(), 100)
    window.addEventListener('resize', () => this.adjustSegmentWidths())
  }

  disconnect() {
    window.removeEventListener('resize', () => this.adjustSegmentWidths())
  }

  adjustSegmentWidths() {
    // Adjust segment overlay widths to account for flexbox gaps
    const container = this.cardTarget?.querySelector('.timeline-days-container')
    if (!container) return

    const overlays = this.cardTarget.querySelectorAll('.timeline-segment-overlay')
    overlays.forEach(overlay => {
      const startDay = parseInt(overlay.dataset.startDay)
      const endDay = parseInt(overlay.dataset.endDay)
      const duration = parseInt(overlay.dataset.duration) || this.durationValue
      
      if (!startDay || !endDay || !duration) return

      // Get the actual day cell elements
      // Account for gap elements: day N is at position (2*N - 1) because gaps are between days
      const firstDayCell = container.querySelector(`.timeline-day-cell-wrapper:nth-child(${startDay * 2 - 1}) .timeline-day-cell`)
      const lastDayCell = container.querySelector(`.timeline-day-cell-wrapper:nth-child(${endDay * 2 - 1}) .timeline-day-cell`)
      
      if (!firstDayCell || !lastDayCell) return

      // Calculate actual pixel positions
      const containerRect = container.getBoundingClientRect()
      const firstRect = firstDayCell.getBoundingClientRect()
      const lastRect = lastDayCell.getBoundingClientRect()
      
      const left = firstRect.left - containerRect.left
      const right = lastRect.right - containerRect.left
      const width = right - left

      // Apply the calculated width
      overlay.style.left = `${left}px`
      overlay.style.width = `${width}px`
    })
  }

  startSelection(event) {
    if (!this.canEditValue) return
    
    // Check if the day is already part of a segment
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
    
    // Check if the day is already part of a segment
    if (event.currentTarget.classList.contains('segment-day')) {
      return
    }
    
    const day = parseInt(event.currentTarget.dataset.day)
    this.endDay = day
    
    // Calculate range
    const start = Math.min(this.startDay, this.endDay)
    const end = Math.max(this.startDay, this.endDay)
    
    this.selectedDays.clear()
    // Only add days that are not part of segments
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
    
    // Prevent click events from firing
    event.preventDefault()
    event.stopPropagation()
  }

  updateVisualSelection() {
    // Remove previous selection highlights
    this.cardTarget.querySelectorAll('.timeline-day-cell').forEach(cell => {
      cell.classList.remove('selected')
    })
    
    // Add selection highlights
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
    
    // Verify that none of the selected days are already part of a segment
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
    formData.append('feature_segment[name]', name)
    formData.append('feature_segment[start_day]', start)
    formData.append('feature_segment[end_day]', end)
    
    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/project_features/${this.featureIdValue}/feature_segments`,
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
        // Reload the page to show the new segment
        window.location.reload()
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
    const day = parseInt(event.currentTarget.dataset.day)
    
    if (!confirm(`Do you want to place a checkpoint here?\n\nThis checkpoint will be placed at the end of day ${day}, before day ${day + 1}.`)) {
      return
    }
    
    this.createCheckpoint(day)
  }

  async addCheckpoint() {
    if (this.selectedDays.size === 0) {
      alert('Please select at least one day for the checkpoint')
      return
    }
    
    // For checkpoint, use the last selected day (checkpoint goes at the end of that day, before the next day)
    const day = Math.max(...Array.from(this.selectedDays))
    this.createCheckpoint(day)
  }

  async createCheckpoint(day) {
    // Verify that the gap is not locked (adjacent to a segment)
    const gap = this.cardTarget.querySelector(`.timeline-day-gap[data-day="${day}"]`)
    if (gap && gap.classList.contains('gap-locked')) {
      alert('Cannot add checkpoint: The gap is adjacent to a segment. Please select a gap between non-segment days.')
      return
    }
    
    const formData = new FormData()
    formData.append('feature_checkpoint[day]', day.toString())
    
    console.log('Creating checkpoint with day:', day, 'for feature:', this.featureIdValue)
    
    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/project_features/${this.featureIdValue}/feature_checkpoints`,
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
        // Reload the page to show the new checkpoint
        window.location.reload()
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
        `/projects/${this.projectIdValue}/project_features/${this.featureIdValue}/feature_segments/${segmentId}`,
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
        // Reload the page to reflect the deletion
        window.location.reload()
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
        `/projects/${this.projectIdValue}/project_features/${this.featureIdValue}/feature_checkpoints/${checkpointId}`,
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
        // Reload the page to reflect the deletion
        window.location.reload()
      } else {
        alert('Error: ' + (data.errors || ['Failed to delete checkpoint']).join(', '))
      }
    } catch (error) {
      console.error('Error deleting checkpoint:', error)
      alert('An error occurred while deleting the checkpoint')
    }
  }
}

