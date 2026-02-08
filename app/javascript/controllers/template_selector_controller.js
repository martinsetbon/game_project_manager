import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["templateList"]
  static values = {
    projectId: Number,
    featureId: Number,
    featureDuration: Number,
    users: Array
  }

  connect() {
    console.log('Template selector controller connected')
    this.loadTemplates()
    // Listen for reload events
    this.reloadHandler = () => {
      console.log('Templates reload event received')
      this.loadTemplates()
    }
    window.addEventListener('templates:reload', this.reloadHandler)
    
    // Reload templates when modal is shown (in case templates were added)
    const modalElement = this.element.closest('.modal')
    if (modalElement) {
      modalElement.addEventListener('shown.bs.modal', () => {
        console.log('Modal shown event, reloading templates...')
        this.loadTemplates()
      })
    }
  }

  disconnect() {
    if (this.reloadHandler) {
      window.removeEventListener('templates:reload', this.reloadHandler)
    }
  }

  async loadTemplates() {
    try {
      console.log('Loading templates...')
      const csrfToken = document.querySelector('meta[name="csrf-token"]')
      const headers = {
        'Accept': 'application/json'
      }
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken.content
      }
      
      const response = await fetch('/feature_templates', {
        method: 'GET',
        headers: headers,
        credentials: 'same-origin'
      })
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        this.templateListTarget.innerHTML = `<div class="text-danger">Failed to load templates (Status: ${response.status})</div>`
        return
      }
      
      const data = await response.json()
      console.log('Templates data:', data)
      
      if (data.status === 'success') {
        console.log('Templates found:', data.templates.length)
        this.renderTemplates(data.templates)
      } else {
        console.error('Error in response:', data)
        this.templateListTarget.innerHTML = '<div class="text-danger">Failed to load templates: ' + (data.errors || ['Unknown error']).join(', ') + '</div>'
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      this.templateListTarget.innerHTML = '<div class="text-danger">Error loading templates: ' + error.message + '</div>'
    }
  }

  renderTemplates(templates) {
    console.log('Rendering templates:', templates)
    
    if (!templates || templates.length === 0) {
      this.templateListTarget.innerHTML = '<div class="text-muted">No templates yet. Create one to get started!</div>'
      return
    }
    
    const templatesHtml = templates.map(template => {
      const createdDate = template.created_at ? new Date(template.created_at).toLocaleDateString() : 'Unknown date'
      return `
        <div class="template-item mb-2 p-3 border rounded">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">${this.escapeHtml(template.name)}</h6>
              <small class="text-muted">
                ${template.department || 'No department'} • ${template.tasks_count || 0} task(s) • 
                Created ${createdDate}
              </small>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-primary" 
                      data-action="click->template-selector#applyTemplate"
                      data-template-id="${template.id}">
                Apply
              </button>
              <button type="button" class="btn btn-sm btn-danger" 
                      data-action="click->template-selector#deleteTemplate"
                      data-template-id="${template.id}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `
    }).join('')
    
    this.templateListTarget.innerHTML = templatesHtml
    console.log('Templates rendered:', templates.length)
  }

  showCreateTemplate() {
    // Close choose template modal
    const chooseModal = bootstrap.Modal.getInstance(document.getElementById(`chooseTemplateModal_${this.featureIdValue}`))
    if (chooseModal) {
      chooseModal.hide()
    }
    
    // Show create template modal
    setTimeout(() => {
      const createModal = new bootstrap.Modal(document.getElementById(`taskTemplateModal_${this.featureIdValue}`))
      createModal.show()
    }, 300)
  }

  async applyTemplate(event) {
    const templateId = event.currentTarget.dataset.templateId
    
    if (!confirm('This will replace all existing tasks for this feature. Continue?')) {
      return
    }
    
    try {
      const response = await fetch(`/feature_templates/${templateId}/apply_to_feature`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_feature_id: this.featureIdValue
        })
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        // Close modal and reload
        const modal = bootstrap.Modal.getInstance(document.getElementById(`chooseTemplateModal_${this.featureIdValue}`))
        if (modal) {
          modal.hide()
        }
        setTimeout(() => {
          window.location.reload()
        }, 300)
      } else {
        alert('Error: ' + (data.errors || ['Failed to apply template']).join(', '))
      }
    } catch (error) {
      console.error('Error applying template:', error)
      alert('An error occurred while applying the template')
    }
  }

  async deleteTemplate(event) {
    const templateId = event.currentTarget.dataset.templateId
    
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }
    
    try {
      const response = await fetch(`/feature_templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
          'Accept': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        this.loadTemplates()
      } else {
        alert('Error: ' + (data.errors || ['Failed to delete template']).join(', '))
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('An error occurred while deleting the template')
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

