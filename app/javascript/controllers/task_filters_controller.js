import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["list"]

  filter(event) {
    const filterType = event.currentTarget.dataset.filter
    
    // Update active button
    this.element.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active')
    })
    event.currentTarget.classList.add('active')
    
    // Filter tasks
    const taskItems = this.listTarget.querySelectorAll('.task-item')
    
    taskItems.forEach(item => {
      const priority = item.dataset.priority || 'none'
      const status = item.dataset.status
      const isBacklog = item.dataset.backlog === 'true'
      
      let show = true
      
      switch(filterType) {
        case 'all':
          show = true
          break
        case 'backlog-only':
          show = isBacklog
          break
        case 'no-backlog':
          show = !isBacklog
          break
        case 'priority-high':
          show = priority === 'high'
          break
        case 'priority-medium':
          show = priority === 'medium'
          break
        case 'priority-low':
          show = priority === 'low'
          break
        default:
          show = true
      }
      
      item.style.display = show ? '' : 'none'
    })
  }
}

