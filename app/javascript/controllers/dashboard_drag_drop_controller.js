import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["draggableTask", "backlogDropZone"]
  static values = { moveTaskUrl: String }
  
  connect() {
    this.draggedItem = null
    this.draggedTaskData = null
    this.isDropping = false
    this.setupDraggableTasks()
    this.setupDropZone()
  }

  setupDraggableTasks() {
    // Make all task items in Current Tasks and Incoming Tasks draggable
    // Note: draggable="true" is set in HTML, we just need to add event listeners
    const taskItems = document.querySelectorAll('.current-tasks-column .task-item[draggable="true"], .incoming-tasks-column .task-item[draggable="true"]')
    
    taskItems.forEach(item => {
      item.addEventListener('dragstart', (e) => this.handleDragStart(e))
      item.addEventListener('dragend', (e) => this.handleDragEnd(e))
    })
  }

  setupDropZone() {
    const backlogSection = document.querySelector('.backlog-tasks-section .tasks-list')
    if (!backlogSection) return

    backlogSection.addEventListener('dragover', (e) => this.handleDragOver(e))
    backlogSection.addEventListener('drop', (e) => this.handleDrop(e))
    backlogSection.addEventListener('dragenter', (e) => this.handleDragEnter(e))
    backlogSection.addEventListener('dragleave', (e) => this.handleDragLeave(e))
  }

  handleDragStart(e) {
    // Prevent expandable controller from interfering
    e.stopPropagation()
    
    const taskItem = e.currentTarget
    taskItem.classList.add('dragging')
    
    // Store reference to dragged item and task data
    this.draggedItem = taskItem
    this.draggedTaskData = this.extractTaskData(taskItem)
    
    // Store task data in dataTransfer
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(this.draggedTaskData))
    
    // Create a ghost image
    const dragImage = taskItem.cloneNode(true)
    dragImage.style.opacity = '0.5'
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  handleDragEnd(e) {
    // Don't interfere if we're in the middle of processing a drop
    if (this.isDropping) {
      return
    }
    
    // Only remove dragging class if drop was not successful
    // (successful drops will remove the element entirely)
    if (this.draggedItem && this.draggedItem.parentNode) {
      this.draggedItem.classList.remove('dragging')
    }
    // Remove drop zone highlight
    const backlogSection = document.querySelector('.backlog-tasks-section .tasks-list')
    if (backlogSection) {
      backlogSection.classList.remove('drag-over')
    }
    
    // Clear references if drop didn't happen
    this.draggedItem = null
    this.draggedTaskData = null
  }

  handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  handleDragEnter(e) {
    e.preventDefault()
    const backlogSection = document.querySelector('.backlog-tasks-section .tasks-list')
    if (backlogSection) {
      backlogSection.classList.add('drag-over')
    }
  }

  handleDragLeave(e) {
    // Only remove highlight if we're leaving the drop zone (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      const backlogSection = document.querySelector('.backlog-tasks-section .tasks-list')
      if (backlogSection) {
        backlogSection.classList.remove('drag-over')
      }
    }
  }

  async handleDrop(e) {
    e.preventDefault()
    this.isDropping = true
    
    const backlogSection = document.querySelector('.backlog-tasks-section .tasks-list')
    if (backlogSection) {
      backlogSection.classList.remove('drag-over')
    }

    try {
      // Use stored task data or try to get from dataTransfer
      const taskData = this.draggedTaskData || JSON.parse(e.dataTransfer.getData('application/json'))
      
      // Call the backend to move task to backlog
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
      if (!csrfToken) {
        alert('CSRF token not found. Please refresh the page and try again.')
        return
      }
      
      const url = this.moveTaskUrlValue || '/dashboard/move_task_to_backlog'
      console.log('Attempting to POST to:', url)
      console.log('Task data:', taskData)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Accept': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        // Handle non-200 responses
        if (response.status === 404) {
          alert('Route not found. Please restart the Rails server and try again.')
        } else {
          const errorText = await response.text()
          console.error('Server error:', response.status, errorText)
          alert(`Server error (${response.status}). Please check the console for details.`)
        }
        return
      }

      const result = await response.json()
      
      if (result.status === 'success') {
        // Remove the task from the source list using stored reference or find by data attributes
        let draggedItem = this.draggedItem
        
        console.log('Looking for dragged item:', draggedItem)
        console.log('Task data:', this.draggedTaskData)
        
        // If we don't have the reference or it's been removed, try to find it by data attributes
        if (!draggedItem || !draggedItem.parentNode) {
          const taskData = this.draggedTaskData
          if (taskData && taskData.feature_id) {
            // Try multiple selectors to find the element
            draggedItem = document.querySelector(`.current-tasks-column [data-feature-id="${taskData.feature_id}"]`) ||
                         document.querySelector(`.incoming-tasks-column [data-feature-id="${taskData.feature_id}"]`) ||
                         document.querySelector(`[data-feature-id="${taskData.feature_id}"]`)
            console.log('Found by feature_id:', draggedItem)
          } else if (taskData && taskData.task_id) {
            draggedItem = document.querySelector(`[data-task-id="${taskData.task_id}"]`)
            console.log('Found by task_id:', draggedItem)
          }
        }
        
        if (draggedItem && draggedItem.parentNode) {
          console.log('Removing dragged item:', draggedItem)
          draggedItem.style.transition = 'opacity 0.3s ease-out'
          draggedItem.style.opacity = '0'
          draggedItem.style.transform = 'scale(0.95)'
          setTimeout(() => {
            if (draggedItem && draggedItem.parentNode) {
              draggedItem.remove()
            }
            // Reload the page to refresh the backlog
            window.location.reload()
          }, 300)
        } else {
          console.log('Could not find dragged item, reloading page')
          // If we can't find the dragged item, just reload
          window.location.reload()
        }
        
        // Clear the references
        this.draggedItem = null
        this.draggedTaskData = null
        this.isDropping = false
      } else {
        alert(`Error: ${result.errors?.join(', ') || 'Failed to move task to backlog'}`)
        // Clear the references on error too
        this.draggedItem = null
        this.draggedTaskData = null
        this.isDropping = false
      }
    } catch (error) {
      console.error('Error moving task to backlog:', error)
      this.isDropping = false
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        alert('Server returned an error page instead of JSON. The route may not be registered. Please restart the Rails server.')
      } else {
        alert(`An error occurred while moving the task to backlog: ${error.message}`)
      }
      // Clear references on error
      this.draggedItem = null
      this.draggedTaskData = null
    }
  }

  extractTaskData(taskItem) {
    // Extract task data from the DOM element
    // Check if it's a feature-based task (from Current/Incoming) or an actual Task
    const taskType = taskItem.dataset.taskType || this.detectTaskType(taskItem)
    const taskId = taskItem.dataset.taskId
    const featureId = taskItem.dataset.featureId || this.findFeatureId(taskItem)
    
    return {
      task_type: taskType,
      task_id: taskId,
      feature_id: featureId,
      task_name: this.findTaskName(taskItem)
    }
  }

  detectTaskType(taskItem) {
    // Check if it's in current tasks or incoming tasks (features) vs backlog (tasks)
    if (taskItem.closest('.current-tasks-column') || taskItem.closest('.incoming-tasks-column')) {
      return 'feature'
    }
    return 'task'
  }

  findFeatureId(taskItem) {
    // Try to find feature ID from links or data attributes
    const featureLink = taskItem.querySelector('a[href*="project_features"]')
    if (featureLink) {
      const match = featureLink.href.match(/project_features\/(\d+)/)
      return match ? match[1] : null
    }
    return null
  }

  findTaskName(taskItem) {
    const nameElement = taskItem.querySelector('.task-name')
    return nameElement ? nameElement.textContent.trim() : 'Untitled Task'
  }
}

