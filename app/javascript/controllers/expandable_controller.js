import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["content"]

  toggle() {
    const content = this.contentTarget
    const icon = this.element.querySelector('.expand-icon')
    const header = this.element.querySelector('.item-header')
    
    // Check if this is a flex container (like the activity history panel)
    const isFlexContainer = content.classList.contains('activity-history-panel') || 
                           content.classList.contains('task-details') ||
                           content.dataset.flexDisplay === 'true'
    
    if (content.style.display === 'none' || content.style.display === '') {
      content.style.display = isFlexContainer ? 'flex' : 'block'
      if (icon) {
        icon.classList.remove('bi-chevron-down', 'bi-chevron-left')
        icon.classList.add('bi-chevron-up', 'bi-chevron-right')
      }
      // Add transition for smooth expansion
      content.style.transition = 'all 0.3s ease'
      this.element.setAttribute('data-expanded', 'true')
      this.element.classList.add('expanded')
    } else {
      content.style.display = 'none'
      if (icon) {
        icon.classList.remove('bi-chevron-up', 'bi-chevron-right')
        icon.classList.add('bi-chevron-down', 'bi-chevron-left')
      }
      this.element.removeAttribute('data-expanded')
      this.element.classList.remove('expanded')
    }
  }
}
