import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "searchInput", "taskSelect", "timelineDays", "selectedInfo"]
  static values = {
    projectId: Number,
    taskId: Number,
    tasks: String
  }

  connect() {
    this.allTasks = this.parseJsonValue(this.tasksValue, [])
    this.filteredTasks = [...this.allTasks]
    this.selectedTask = null
    this.selectedAnchorDay = null
    this.renderOptions()
  }

  toggleLinkPanel() {
    if (!this.hasPanelTarget) return
    const isOpen = this.panelTarget.style.display !== 'none'
    this.panelTarget.style.display = isOpen ? 'none' : 'block'
  }

  filterTasks() {
    const query = (this.searchInputTarget?.value || '').toLowerCase()
    this.filteredTasks = this.allTasks.filter(t => t.name.toLowerCase().includes(query))
    this.renderOptions()
  }

  renderOptions() {
    if (!this.hasTaskSelectTarget) return
    this.taskSelectTarget.innerHTML = '<option value="">Select a task...</option>'
    this.filteredTasks.forEach(task => {
      const option = document.createElement('option')
      option.value = task.id
      option.textContent = task.name
      this.taskSelectTarget.appendChild(option)
    })
  }

  selectTask() {
    const id = parseInt(this.taskSelectTarget.value, 10)
    this.selectedTask = this.allTasks.find(t => t.id === id) || null
    this.selectedAnchorDay = null
    this.renderTimeline()
  }

  renderTimeline() {
    if (!this.hasTimelineDaysTarget) return
    this.timelineDaysTarget.innerHTML = ''
    this.selectedInfoTarget.textContent = ''

    if (!this.selectedTask) return
    const startDate = this.parseDateString(this.selectedTask.start_date)
    const endDate = this.parseDateString(this.selectedTask.end_date)
    const duration = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)
    const segments = this.selectedTask.segments || []

    for (let day = 1; day <= duration; day += 1) {
      const dateLabel = new Date(startDate)
      dateLabel.setDate(startDate.getDate() + (day - 1))
      const wrapper = document.createElement('div')
      wrapper.className = 'timeline-day-cell-wrapper'

      const number = document.createElement('div')
      number.className = 'timeline-day-number'
      number.innerHTML = `${day}<span class="day-date">${this.formatDateMMDD(dateLabel)}</span>`
      wrapper.appendChild(number)

      const cell = document.createElement('div')
      cell.className = 'timeline-day-cell'
      cell.dataset.day = day
      cell.addEventListener('click', () => this.selectAnchorDay(day))
      wrapper.appendChild(cell)
      this.timelineDaysTarget.appendChild(wrapper)

      if (day < duration) {
        const gap = document.createElement('div')
        gap.className = 'timeline-day-gap'
        this.timelineDaysTarget.appendChild(gap)
      }
    }

    segments.forEach(segment => {
      if (segment.start_day > duration) return
      const segmentDays = Math.max(1, segment.end_day - segment.start_day + 1)
      const startPercent = ((segment.start_day - 1) / duration) * 100
      const startGap = (segment.start_day - 1) * 8
      const widthPercent = (segmentDays / duration) * 100
      const widthGap = (segmentDays - 1) * 8
      const overlay = document.createElement('div')
      overlay.className = 'timeline-segment-overlay'
      overlay.dataset.segmentId = segment.id
      overlay.dataset.startDay = segment.start_day
      overlay.dataset.endDay = segment.end_day
      overlay.dataset.duration = duration
      overlay.style.setProperty('--segment-start-percent', `${startPercent}%`)
      overlay.style.setProperty('--segment-start-gap', `${startGap}px`)
      overlay.style.setProperty('--segment-width-percent', `${widthPercent}%`)
      overlay.style.setProperty('--segment-width-gap', `${widthGap}px`)
      overlay.style.background = segment.color || '#7c3aed'
      overlay.innerHTML = `
        <div class="segment-content">
          <span class="segment-name">${segment.name}</span>
        </div>
      `
      this.timelineDaysTarget.appendChild(overlay)
    })
  }

  selectAnchorDay(day) {
    this.selectedAnchorDay = day
    this.timelineDaysTarget.querySelectorAll('.timeline-day-cell').forEach(cell => {
      cell.classList.toggle('selected', parseInt(cell.dataset.day, 10) === day)
    })
    if (this.selectedInfoTarget) {
      this.selectedInfoTarget.textContent = `Linked to day ${day} of "${this.selectedTask.name}"`
    }
  }

  async saveLink() {
    if (!this.selectedTask || !this.selectedAnchorDay) {
      alert('Select a task and a day to link.')
      return
    }

    const alignNow = window.confirm('Align the start date with the selected day now?\n\nOK = Align\nCancel = Keep original position')

    const formData = new FormData()
    formData.append('source_task_id', this.selectedTask.id)
    formData.append('anchor_day', this.selectedAnchorDay)
    formData.append('align_now', alignNow)

    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_links`,
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
      let data = null
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        // ignore parse error
      }
      if (response.ok && (!data || data.status === 'success')) {
        window.location.reload()
      } else if (data?.errors) {
        alert('Error: ' + data.errors.join(', '))
      } else {
        alert('Error: Failed to link task')
      }
    } catch (error) {
      console.error('Error saving link:', error)
      alert('An error occurred while linking the task')
    }
  }

  async breakLink(event) {
    const linkId = event.params?.linkId
    const pathId = linkId != null && linkId !== '' ? linkId : '0'
    try {
      const response = await fetch(
        `/projects/${this.projectIdValue}/tasks/${this.taskIdValue}/task_links/${pathId}`,
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
        window.location.reload()
      } else {
        alert('Error: ' + (data.errors || ['Failed to break link']).join(', '))
      }
    } catch (error) {
      console.error('Error breaking link:', error)
      alert('An error occurred while breaking the link')
    }
  }

  parseDateString(dateString) {
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(n => parseInt(n, 10))
    return new Date(year, month - 1, day)
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

