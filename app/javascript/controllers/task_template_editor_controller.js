import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["taskList", "nameInput", "durationInput", "totalDuration", "durationWarning", "saveButton", "responsibleInput", "accountableInput", "templateName", "templateDepartment"]
  static values = {
    projectId: Number,
    featureId: Number,
    featureDuration: Number,
    users: String
  }

  connect() {
    console.log('Task template editor controller connected')
    
    // Parse users from JSON string
    // The value comes as a JSON string from the HTML attribute
    try {
      let usersData = this.usersValue
      
      // If it's already an array, use it directly
      if (Array.isArray(usersData)) {
        this.parsedUsers = usersData
      } else if (typeof usersData === 'string') {
        // Try to parse as JSON
        // Handle HTML entities that might be encoded by Rails
        let jsonString = usersData
        // Decode common HTML entities
        jsonString = jsonString.replace(/&quot;/g, '"')
                               .replace(/&#39;/g, "'")
                               .replace(/&amp;/g, '&')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>')
        
        // Try parsing
        this.parsedUsers = JSON.parse(jsonString)
      } else {
        console.warn('Users value is not a valid format:', typeof usersData)
        this.parsedUsers = []
      }
    } catch (e) {
      console.error('Error parsing users:', e)
      console.error('Raw usersValue:', this.usersValue)
      console.error('Type:', typeof this.usersValue)
      this.parsedUsers = []
    }
    
    // Find the modal element and listen for when it's shown
    const modalElement = this.element.closest('.modal')
    if (modalElement) {
      console.log('Found modal element:', modalElement.id)
      
      // When modal is shown, attach click handler to save button
      const modalShownHandler = () => {
        console.log('Modal shown event fired, looking for save button...')
        // Try multiple times with delays to ensure button is rendered
        setTimeout(() => this.attachSaveButtonHandler(), 50)
        setTimeout(() => this.attachSaveButtonHandler(), 200)
        setTimeout(() => this.attachSaveButtonHandler(), 500)
      }
      
      modalElement.addEventListener('shown.bs.modal', modalShownHandler, { once: false })
      
      // Also try immediately if modal is already shown
      if (modalElement.classList.contains('show')) {
        console.log('Modal already shown, attaching handler immediately')
        setTimeout(() => this.attachSaveButtonHandler(), 100)
        setTimeout(() => this.attachSaveButtonHandler(), 300)
      }
    } else {
      console.log('Modal element not found, using fallback')
      // Fallback: try after delays
      setTimeout(() => this.attachSaveButtonHandler(), 200)
      setTimeout(() => this.attachSaveButtonHandler(), 500)
      setTimeout(() => this.attachSaveButtonHandler(), 1000)
    }
    
    // Also try to attach handler immediately (in case button is already in DOM)
    setTimeout(() => this.attachSaveButtonHandler(), 100)
    
    // GLOBAL FALLBACK: Listen for clicks on any button with "Save Template" text
    // This is a last resort if Stimulus isn't working
    const globalClickHandler = (e) => {
      const target = e.target.closest('button')
      if (target && (target.textContent.includes('Save Template') || target.id.includes('saveTemplateBtn'))) {
        // Check if this button is within our controller's modal
        const modal = target.closest('.modal')
        const controllerModal = this.element.closest('.modal')
        if (modal && modal === controllerModal) {
          console.log('=== Global fallback: Save Template button clicked ===')
          console.log('Target button:', target)
          console.log('Target ID:', target.id)
          e.preventDefault()
          e.stopPropagation()
          // Store reference to this controller instance
          const controller = this
          // Call saveTemplate with proper context
          controller.saveTemplate(e)
        }
      }
    }
    
    // Store handler reference so we can remove it later if needed
    this.globalClickHandler = globalClickHandler
    document.addEventListener('click', globalClickHandler, true) // Use capture phase
    
    this.updateTotalDuration()
  }

  attachSaveButtonHandler() {
    console.log('attachSaveButtonHandler called')
    console.log('Controller element:', this.element)
    console.log('Feature ID:', this.featureIdValue)
    
    // Try multiple ways to find the save button
    let saveBtn = null
    
    // Method 1: Use Stimulus target
    if (this.hasSaveButtonTarget) {
      saveBtn = this.saveButtonTarget
      console.log('Found save button via Stimulus target')
    } else {
      console.log('Stimulus target not found, trying other methods...')
      
      // Method 2: Find by ID (search in entire document, not just controller element)
      const btnId = `saveTemplateBtn_${this.featureIdValue}`
      saveBtn = document.getElementById(btnId)
      if (saveBtn) {
        console.log('Found save button by ID:', btnId)
      } else {
        console.log('Button not found by ID:', btnId)
        
        // Method 3: Find by data attribute within controller element
        saveBtn = this.element.querySelector('[data-task-template-editor-target="saveButton"]')
        if (saveBtn) {
          console.log('Found save button by data attribute')
        } else {
          console.log('Button not found by data attribute')
          
          // Method 4: Find any button with "Save Template" text in controller element
          const buttons = this.element.querySelectorAll('button')
          console.log('Found buttons in element:', buttons.length)
          for (let btn of buttons) {
            console.log('Button text:', btn.textContent.trim())
            if (btn.textContent.includes('Save Template')) {
              saveBtn = btn
              console.log('Found save button by text content')
              break
            }
          }
          
          // Method 5: Search in entire document for button with matching ID pattern
          if (!saveBtn) {
            const allButtons = document.querySelectorAll(`[id^="saveTemplateBtn_"]`)
            console.log('Found buttons with saveTemplateBtn prefix:', allButtons.length)
            if (allButtons.length > 0) {
              saveBtn = allButtons[0]
              console.log('Found save button by ID pattern')
            }
          }
        }
      }
    }
    
    if (saveBtn) {
      console.log('✅ Save button found!', saveBtn)
      console.log('Button ID:', saveBtn.id)
      console.log('Button text:', saveBtn.textContent.trim())
      console.log('Button data-action:', saveBtn.getAttribute('data-action'))
      
      // Ensure the Stimulus action attribute is set
      if (!saveBtn.getAttribute('data-action') || !saveBtn.getAttribute('data-action').includes('saveTemplate')) {
        console.log('Adding data-action attribute to button')
        const existingAction = saveBtn.getAttribute('data-action') || ''
        saveBtn.setAttribute('data-action', existingAction + ' click->task-template-editor#saveTemplate')
      }
      
      // Add click handler directly as backup (don't clone, as that breaks Stimulus)
      // Use capture phase to ensure it fires before other handlers
      const handler = (e) => {
        console.log('=== Save button clicked! (direct handler) ===')
        console.log('Event:', e)
        console.log('Event currentTarget:', e.currentTarget)
        console.log('Event target:', e.target)
        e.preventDefault()
        e.stopPropagation()
        // Call saveTemplate with proper context
        this.saveTemplate(e)
      }
      
      // Remove any existing handler first (if any)
      saveBtn.removeEventListener('click', handler, true)
      saveBtn.addEventListener('click', handler, true)
      
      // Also add a regular click handler as ultimate fallback
      const fallbackHandler = (e) => {
        console.log('=== Save button clicked! (fallback handler) ===')
        if (!e.defaultPrevented) {
          e.preventDefault()
          e.stopPropagation()
          this.saveTemplate(e)
        }
      }
      saveBtn.addEventListener('click', fallbackHandler, false)
      
      console.log('✅ Save button handler attached successfully')
    } else {
      console.error('❌ Could not find save button anywhere!')
      console.error('Controller element:', this.element)
      console.error('Controller element tag:', this.element.tagName)
      console.error('Controller element classes:', this.element.className)
      console.error('Controller element children:', this.element.children.length)
      console.error('Controller element innerHTML length:', this.element.innerHTML.length)
      console.error('All buttons in document:', Array.from(document.querySelectorAll('button[id*="saveTemplate"]')).map(b => ({ id: b.id, text: b.textContent.trim() })))
      console.error('All buttons in controller element:', Array.from(this.element.querySelectorAll('button')).map(b => ({ id: b.id, text: b.textContent.trim(), classes: b.className })))
      
      // Last resort: search entire document for any button with "Save Template" text
      const allDocButtons = Array.from(document.querySelectorAll('button'))
      console.error('Total buttons in document:', allDocButtons.length)
      for (let btn of allDocButtons) {
        if (btn.textContent.includes('Save Template')) {
          console.error('Found Save Template button in document:', btn)
          console.error('Button parent:', btn.parentElement)
          console.error('Button ID:', btn.id)
        }
      }
    }
  }

  addTask() {
    const users = this.parsedUsers || []
    const responsibleOptions = users.map(u => 
      `<option value="${u.id}">${u.name} - ${u.job || ''}</option>`
    ).join('')
    const accountableOptions = users.map(u => 
      `<option value="${u.id}">${u.name} - ${u.job || ''}</option>`
    ).join('')
    
    const taskItem = document.createElement('div')
    taskItem.className = 'task-template-item mb-2'
    taskItem.innerHTML = `
      <div class="d-flex flex-column gap-2">
        <div class="d-flex align-items-center gap-2">
          <input type="text" class="form-control task-name-input" 
                 placeholder="Task name"
                 data-task-template-editor-target="nameInput">
          <input type="number" class="form-control task-duration-input" 
                 value="1" 
                 min="1" 
                 placeholder="Days"
                 style="width: 100px;"
                 data-task-template-editor-target="durationInput"
                 data-action="input->task-template-editor#updateTotalDuration">
          <span class="text-muted">days</span>
          <button type="button" class="btn btn-sm btn-danger" 
                  data-action="click->task-template-editor#removeTask">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="d-flex align-items-center gap-2">
          <select class="form-control form-control-sm task-responsible-input" 
                  data-task-template-editor-target="responsibleInput">
            <option value="0">No Responsible</option>
            ${responsibleOptions}
          </select>
          <select class="form-control form-control-sm task-accountable-input" 
                  data-task-template-editor-target="accountableInput">
            <option value="0">No Accountable</option>
            ${accountableOptions}
          </select>
        </div>
      </div>
    `
    this.taskListTarget.appendChild(taskItem)
    this.updateTotalDuration()
  }

  removeTask(event) {
    const taskItem = event.currentTarget.closest('.task-template-item')
    if (taskItem) {
      taskItem.remove()
      this.updateTotalDuration()
    }
  }

  updateTotalDuration() {
    if (!this.hasTaskListTarget) return
    
    const durationInputs = this.taskListTarget.querySelectorAll('.task-duration-input')
    let total = 0
    durationInputs.forEach(input => {
      const value = parseInt(input.value) || 0
      total += value
    })
    
    if (this.hasTotalDurationTarget) {
      this.totalDurationTarget.textContent = total
    }
    
    // Show warning if total exceeds feature duration
    if (this.hasDurationWarningTarget) {
      if (total > this.featureDurationValue) {
        this.durationWarningTarget.style.display = 'inline'
        if (this.hasSaveButtonTarget) {
          this.saveButtonTarget.disabled = true
          this.saveButtonTarget.classList.add('disabled')
        }
      } else {
        this.durationWarningTarget.style.display = 'none'
        if (this.hasSaveButtonTarget) {
          this.saveButtonTarget.disabled = false
          this.saveButtonTarget.classList.remove('disabled')
        }
      }
    }
  }

  async saveTemplate(event) {
    console.log('=== saveTemplate FUNCTION CALLED ===')
    console.log('Event:', event)
    console.log('Event type:', event?.type)
    console.log('Event target:', event?.target)
    console.log('This:', this)
    console.log('Controller element:', this.element)
    
    // Prevent default if it's an event
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    // Add a visual indicator that the function was called
    const button = event?.target?.closest('button') || document.querySelector(`#saveTemplateBtn_${this.featureIdValue}`)
    if (button) {
      button.disabled = true
      button.textContent = 'Saving...'
    }
    
    if (!this.hasTaskListTarget) {
      console.error('taskListTarget not found')
      alert('Task list not found. Please refresh the page.')
      return
    }
    
    const taskItems = this.taskListTarget.querySelectorAll('.task-template-item')
    console.log('Found task items:', taskItems.length)
    const tasks = []
    
    taskItems.forEach(item => {
      const nameInput = item.querySelector('.task-name-input')
      const durationInput = item.querySelector('.task-duration-input')
      const responsibleInput = item.querySelector('.task-responsible-input')
      const accountableInput = item.querySelector('.task-accountable-input')
      
      if (!nameInput || !durationInput) {
        console.warn('Missing input fields in task item')
        return
      }
      
      const name = nameInput.value.trim()
      const duration = parseInt(durationInput.value) || 0
      const responsibleUserId = responsibleInput ? parseInt(responsibleInput.value) || 0 : 0
      const accountableUserId = accountableInput ? parseInt(accountableInput.value) || 0 : 0
      
      if (name && duration > 0) {
        tasks.push({
          name: name,
          duration: duration,
          responsible_user_id: responsibleUserId > 0 ? responsibleUserId : null,
          accountable_user_id: accountableUserId > 0 ? accountableUserId : null
        })
      }
    })
    
    console.log('Tasks collected:', tasks)
    
    // Validate total duration
    const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0)
    if (totalDuration > this.featureDurationValue) {
      alert(`Total task duration (${totalDuration} days) exceeds feature duration (${this.featureDurationValue} days). Please adjust the durations.`)
      return
    }
    
    if (tasks.length === 0) {
      alert('Please add at least one task.')
      return
    }
    
    // Validate all tasks have names
    const invalidTasks = tasks.filter(t => !t.name || t.duration <= 0)
    if (invalidTasks.length > 0) {
      alert('Please ensure all tasks have a name and duration greater than 0.')
      return
    }
    
    // Get template name
    const templateNameInput = this.element.querySelector('[data-task-template-editor-target="templateName"]')
    if (!templateNameInput) {
      alert('Template name field not found. Please refresh the page.')
      console.error('templateNameTarget not found')
      return
    }
    
    const templateName = templateNameInput.value.trim()
    console.log('Template name:', templateName)
    
    if (!templateName) {
      alert('Please enter a template name.')
      templateNameInput.focus()
      return
    }
    
    // Get department
    const departmentInput = this.element.querySelector('[data-task-template-editor-target="templateDepartment"]')
    const department = departmentInput ? departmentInput.value : null
    console.log('Department:', department)
    
    // Prepare template data
    const templateData = {
      feature_template: {
        name: templateName,
        department: department,
        tasks_data: tasks
      }
    }
    
    console.log('Sending template data:', templateData)
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')
      if (!csrfToken) {
        alert('CSRF token not found. Please refresh the page.')
        return
      }
      
      console.log('Making POST request to /feature_templates...')
      const response = await fetch('/feature_templates', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken.content,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      const responseText = await response.text()
      console.log('Response text:', responseText)
      
      if (!response.ok) {
        console.error('Error response:', responseText)
        try {
          const errorData = JSON.parse(responseText)
          alert('Error: ' + (errorData.errors || ['Failed to save template']).join(', '))
        } catch (e) {
          alert('Error: Failed to save template. Status: ' + response.status + '\n' + responseText.substring(0, 200))
        }
        return
      }
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        console.error('Failed to parse response as JSON:', e)
        alert('Error: Server returned invalid JSON response')
        return
      }
      
      console.log('Response data:', data)
      
      if (data.status === 'success') {
        console.log('Template saved successfully!', data)
        
        // Close create template modal
        const modalElement = document.getElementById(`taskTemplateModal_${this.featureIdValue}`)
        if (modalElement) {
          const modal = bootstrap.Modal.getInstance(modalElement)
          if (modal) {
            modal.hide()
          }
        }
        
        // Show success message
        alert('Template saved successfully!')
        
        // Wait for modal to close, then show choose template modal
        setTimeout(() => {
          const chooseModalElement = document.getElementById(`chooseTemplateModal_${this.featureIdValue}`)
          if (chooseModalElement) {
            // Show the choose template modal
            const chooseModal = bootstrap.Modal.getInstance(chooseModalElement) || new bootstrap.Modal(chooseModalElement)
            chooseModal.show()
            
            // Reload templates after a short delay to ensure modal is fully shown
            setTimeout(() => {
              console.log('Triggering template reload...')
              window.dispatchEvent(new CustomEvent('templates:reload'))
            }, 500)
          }
        }, 300)
      } else {
        console.error('Save failed:', data)
        alert('Error: ' + (data.errors || ['Failed to save template']).join(', '))
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('An error occurred while saving the template: ' + error.message)
    }
  }
}


