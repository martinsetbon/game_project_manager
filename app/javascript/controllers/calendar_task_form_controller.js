import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = []

  connect() {
    // Calculate duration when dates change
    const startDateInput = this.element.querySelector('#task_start_date')
    const endDateInput = this.element.querySelector('#task_end_date')
    const durationInput = this.element.querySelector('#task_duration')
    
    if (startDateInput && endDateInput && durationInput) {
      const updateDuration = () => {
        if (startDateInput.value && endDateInput.value) {
          const start = new Date(startDateInput.value)
          const end = new Date(endDateInput.value)
          const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
          if (duration > 0) {
            durationInput.value = duration
          }
        }
      }
      
      startDateInput.addEventListener('change', updateDuration)
      endDateInput.addEventListener('change', updateDuration)
    }
    
    // Listen for form submit
    if (this.element.tagName === 'FORM') {
      this.element.addEventListener('submit', (e) => this.handleSubmitStart(e))
    }

    // Listen for Turbo submit end
    this.element.addEventListener('turbo:submit-end', (e) => this.handleSubmit(e))
  }

  handleSubmitStart(event) {
    const form = event.target
    const startDate = form.querySelector('#task_start_date')?.value
    const endDate = form.querySelector('#task_end_date')?.value
    const responsibleId = form.querySelector('#task_responsible_user_id')?.value

    if (!startDate || !endDate || !responsibleId) return

    const tasksDataElement = document.querySelector('[data-calendar-timeline-target="tasksData"]')
    if (!tasksDataElement) return

    let tasks = []
    try {
      tasks = JSON.parse(tasksDataElement.textContent) || []
    } catch (e) {
      return
    }

    const start = this.normalizeDate(startDate)
    const end = this.normalizeDate(endDate)
    const responsibleIdNum = parseInt(responsibleId, 10)

    const overlaps = tasks.filter(task => {
      const responsibleIds = (task.responsible_users || []).map(u => u.id)
      if (!responsibleIds.includes(responsibleIdNum)) return false
      if (!task.start_date || !task.end_date) return false
      const taskStart = this.normalizeDate(task.start_date)
      const taskEnd = this.normalizeDate(task.end_date)
      return start <= taskEnd && end >= taskStart
    })

    if (overlaps.length > 0) {
      const proceed = window.confirm('This contributor already has a task overlapping in time with this one.\n\nDo you want to proceed anyway?')
      if (!proceed) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      let proceedInput = form.querySelector('input[name="proceed"]')
      if (!proceedInput) {
        proceedInput = document.createElement('input')
        proceedInput.type = 'hidden'
        proceedInput.name = 'proceed'
        proceedInput.value = 'true'
        form.appendChild(proceedInput)
      }
    }
  }

  normalizeDate(date) {
    if (typeof date === 'string') {
      const datePart = date.split('T')[0]
      const parts = datePart.split('-').map(p => parseInt(p, 10))
      return new Date(parts[0], parts[1] - 1, parts[2])
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  handleSubmit(event) {
    // Turbo will handle the redirect, but we can close the modal
    // The page will reload automatically due to redirect
    const modalElement = this.element.closest('.modal')
    const modal = bootstrap.Modal.getInstance(modalElement)
    if (modal) {
      // Wait a bit before closing to show success
      setTimeout(() => {
        modal.hide()
      }, 100)
    }
  }
}
