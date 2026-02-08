import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["startDate", "endDate", "submitBtn"]
  static outlets = []

  connect() {
    this.updateSubmitButton()
    // Listen for changes to date fields
    this.startDateTarget?.addEventListener("change", () => this.updateSubmitButton())
    this.endDateTarget?.addEventListener("change", () => this.updateSubmitButton())
    
    // Initialize modal instance once
    const modalElement = document.getElementById('backlogWarningModal')
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement)
      
      // Set up confirm button handler once
      const confirmBtn = document.getElementById('confirmBacklogBtn')
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          this.handleConfirmBacklog()
        })
      }
    }
  }

  disconnect() {
    // Clean up modal instance
    if (this.modal) {
      this.modal.dispose()
    }
  }

  updateSubmitButton() {
    const startDate = this.startDateTarget?.value
    const endDate = this.endDateTarget?.value
    
    if (!startDate && !endDate) {
      // No dates - change button to "Send to Backlog"
      this.submitBtnTarget.textContent = "Send to Backlog"
      this.submitBtnTarget.classList.remove("btn-primary")
      this.submitBtnTarget.classList.add("btn-secondary")
    } else {
      // Has dates - normal "Create Task" button
      this.submitBtnTarget.textContent = "Create Task"
      this.submitBtnTarget.classList.remove("btn-secondary")
      this.submitBtnTarget.classList.add("btn-primary")
    }
  }

  submit(event) {
    const startDate = this.startDateTarget?.value
    const endDate = this.endDateTarget?.value
    
    // If no dates, show modal instead of submitting directly
    if (!startDate && !endDate) {
      event.preventDefault()
      if (this.modal) {
        this.modal.show()
      }
    }
    // Otherwise, let form submit normally
  }

  handleConfirmBacklog() {
    if (this.modal) {
      this.modal.hide()
    }
    const form = this.element.closest('form')
    if (form) {
      form.submit()
    }
  }
}

