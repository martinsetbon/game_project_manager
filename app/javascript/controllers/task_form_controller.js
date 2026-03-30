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

  async submit(event) {
    const startDate = this.startDateTarget?.value
    const endDate = this.endDateTarget?.value
    
    // If no dates, show modal instead of submitting directly
    if (!startDate && !endDate) {
      event.preventDefault()
      if (this.modal) {
        this.modal.show()
      }
      return
    }
    // Otherwise, confirm template choice before submitting
    event.preventDefault()
    const shouldSubmit = await this.promptTemplate()
    if (shouldSubmit) {
      const form = this.element.closest('form')
      form?.submit()
    }
  }

  async promptTemplate() {
    const form = this.element.closest('form')
    if (!form) return false
    const startDate = this.startDateTarget?.value
    const endDate = this.endDateTarget?.value
    if (!startDate || !endDate) return true
    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    if (duration < 5) return true

    const useTemplate = await this.confirmTemplate()
    let input = form.querySelector('input[name="apply_template"]')
    if (!input) {
      input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'apply_template'
      form.appendChild(input)
    }
    input.value = useTemplate ? 'true' : 'false'
    return true
  }

  confirmTemplate() {
    return new Promise(resolve => {
      const overlay = document.createElement('div')
      overlay.className = 'template-confirm-overlay'
      overlay.innerHTML = `
        <div class="template-confirm-modal">
          <div class="template-confirm-title">Apply default segmentation template?</div>
          <div>This will create segments and checkpoints for the new task.</div>
          <div class="template-confirm-actions">
            <button class="btn btn-sm btn-secondary" data-template-action="no">No thanks</button>
            <button class="btn btn-sm btn-primary" data-template-action="yes">Yes</button>
          </div>
        </div>
      `
      const cleanup = (result) => {
        overlay.remove()
        resolve(result)
      }
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanup(false)
      })
      overlay.querySelector('[data-template-action="no"]').addEventListener('click', () => cleanup(false))
      overlay.querySelector('[data-template-action="yes"]').addEventListener('click', () => cleanup(true))
      document.body.appendChild(overlay)
    })
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

