import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["templateId", "templateSelect", "templateSelector", "createTemplateSection", "newTemplateName", "taskEditor"]
  static values = {
    users: Array
  }

  connect() {
    console.log('Feature template selector controller connected')
    this.loadTemplates()
    this.tasks = []
  }

  async loadTemplates() {
    try {
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
      
      if (!response.ok) {
        console.error('Failed to load templates')
        return
      }
      
      const data = await response.json()
      
      if (data.status === 'success') {
        this.renderTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  renderTemplates(templates) {
    const select = this.templateSelectTarget
    // Clear existing options except the first one
    while (select.options.length > 1) {
      select.remove(1)
    }
    
    templates.forEach(template => {
      const option = document.createElement('option')
      option.value = template.id
      option.textContent = `${template.name} (${template.tasks_count || 0} tasks)`
      select.appendChild(option)
    })
  }

  onTemplateSelect(event) {
    const templateId = event.target.value
    this.templateIdTarget.value = templateId || ''
  }

  showCreateTemplate() {
    this.createTemplateSectionTarget.classList.remove('d-none')
    this.templateSelectorTarget.classList.add('d-none')
    this.addTask() // Add one empty task row
  }

  cancelCreateTemplate() {
    this.createTemplateSectionTarget.classList.add('d-none')
    this.templateSelectorTarget.classList.remove('d-none')
    this.tasks = []
    this.renderTasks()
  }

  addTask() {
    this.tasks.push({
      name: '',
      duration: 1,
      responsible_user_id: null,
      accountable_user_id: null,
      priority: 'high'
    })
    this.renderTasks()
  }

  removeTask(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    this.tasks.splice(index, 1)
    this.renderTasks()
  }

  updateTaskName(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    this.tasks[index].name = event.target.value
  }

  updateTaskDuration(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    this.tasks[index].duration = parseInt(event.target.value) || 1
  }

  updateTaskResponsible(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    const value = event.target.value
    this.tasks[index].responsible_user_id = value ? parseInt(value) : null
  }

  updateTaskAccountable(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    const value = event.target.value
    this.tasks[index].accountable_user_id = value ? parseInt(value) : null
  }

  updateTaskPriority(event) {
    const index = parseInt(event.currentTarget.dataset.index)
    this.tasks[index].priority = event.target.value
  }

  renderTasks() {
    const editor = this.taskEditorTarget
    editor.innerHTML = ''
    
    this.tasks.forEach((task, index) => {
      const taskRow = document.createElement('div')
      taskRow.className = 'task-row mb-2 p-2 border rounded'
      taskRow.innerHTML = `
        <div class="row g-2">
          <div class="col-md-3">
            <input type="text" class="form-control form-control-sm" 
                   placeholder="Task name" 
                   value="${this.escapeHtml(task.name)}"
                   data-index="${index}"
                   data-action="input->feature-template-selector#updateTaskName">
          </div>
          <div class="col-md-2">
            <input type="number" class="form-control form-control-sm" 
                   placeholder="Days" 
                   value="${task.duration}"
                   min="1"
                   data-index="${index}"
                   data-action="input->feature-template-selector#updateTaskDuration">
          </div>
          <div class="col-md-2">
            <select class="form-control form-control-sm" 
                    data-index="${index}"
                    data-action="change->feature-template-selector#updateTaskPriority">
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low (Backlog)</option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-control form-control-sm" 
                    data-index="${index}"
                    data-action="change->feature-template-selector#updateTaskResponsible">
              <option value="">Responsible</option>
              ${this.renderUserOptions(task.responsible_user_id)}
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-control form-control-sm" 
                    data-index="${index}"
                    data-action="change->feature-template-selector#updateTaskAccountable">
              <option value="">Accountable</option>
              ${this.renderUserOptions(task.accountable_user_id)}
            </select>
          </div>
          <div class="col-md-1">
            <button type="button" class="btn btn-sm btn-danger" 
                    data-index="${index}"
                    data-action="click->feature-template-selector#removeTask">
              Remove
            </button>
          </div>
        </div>
      `
      editor.appendChild(taskRow)
    })
  }

  renderUserOptions(selectedId) {
    if (!this.usersValue || !Array.isArray(this.usersValue)) {
      return ''
    }
    
    return this.usersValue.map(user => {
      const selected = user.id === selectedId ? 'selected' : ''
      return `<option value="${user.id}" ${selected}>${this.escapeHtml(user.name)}${user.job ? ' - ' + this.escapeHtml(user.job) : ''}</option>`
    }).join('')
  }

  async saveNewTemplate() {
    const templateName = this.newTemplateNameTarget.value.trim()
    
    if (!templateName) {
      alert('Please enter a template name.')
      return
    }
    
    if (this.tasks.length === 0) {
      alert('Please add at least one task.')
      return
    }
    
    // Validate tasks
    const validTasks = this.tasks.filter(t => t.name.trim() && t.duration > 0)
    if (validTasks.length === 0) {
      alert('Please add at least one valid task with a name and duration.')
      return
    }
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')
      const templateData = {
        feature_template: {
          name: templateName,
          tasks_data: validTasks.map(t => ({
            name: t.name.trim(),
            duration: t.duration,
            priority: t.priority || 'high',
            responsible_user_id: t.responsible_user_id,
            accountable_user_id: t.accountable_user_id
          }))
        }
      }
      
      const response = await fetch('/feature_templates', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken.content,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        // Set the template ID and hide create section
        this.templateIdTarget.value = data.template.id
        this.createTemplateSectionTarget.classList.add('d-none')
        this.templateSelectorTarget.classList.remove('d-none')
        
        // Reload templates to include the new one
        await this.loadTemplates()
        
        // Select the newly created template
        this.templateSelectTarget.value = data.template.id
      } else {
        alert('Error: ' + (data.errors || ['Failed to create template']).join(', '))
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('An error occurred while saving the template')
    }
  }

  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

