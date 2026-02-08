import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  markAsViewed(event) {
    // Prevent default navigation temporarily
    event.preventDefault()
    event.stopPropagation()
    
    // Get notification ID from either the element or the event target
    const notificationId = this.element.dataset.notificationId || 
                         event.currentTarget.dataset.notificationId ||
                         event.target.closest('[data-notification-id]')?.dataset.notificationId
    
    // Get the project URL
    const projectUrl = this.element.dataset.projectUrl || 
                      event.currentTarget.href ||
                      event.target.closest('a')?.href
    
    if (!notificationId) {
      console.error('Could not find notification ID')
      // Allow navigation to continue if we can't find the ID
      if (projectUrl) {
        window.location.href = projectUrl
      }
      return
    }
    
    console.log('Marking notification as viewed:', notificationId)
    
    // Mark as viewed immediately for better UX
    this.updateNotificationStyle()
    
    // Send request to mark as viewed on server
    fetch(`/notifications/${notificationId}/viewed`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('Notification marked as viewed successfully')
        // Update counts in the dashboard
        this.updateDashboardCounts()
      }
      // Navigate to the project page after marking as viewed
      if (projectUrl) {
        window.location.href = projectUrl
      }
    })
    .catch(error => {
      console.error('Error marking notification as viewed:', error)
      // Navigate anyway even if the request fails
      if (projectUrl) {
        window.location.href = projectUrl
      }
    })
  }

  updateNotificationStyle() {
    // Find the notification item (could be this.element or a child)
    const notificationItem = this.element.querySelector('.notification-item') || this.element
    
    // Remove bold styling
    const title = notificationItem.querySelector('.notification-title')
    const message = notificationItem.querySelector('.notification-message')
    const projectName = notificationItem.querySelector('.notification-project-name')
    const unviewedIndicator = notificationItem.querySelector('.unviewed-indicator')
    
    if (title) title.classList.remove('font-weight-bold')
    if (message) message.classList.remove('font-weight-bold')
    if (projectName) projectName.classList.remove('font-weight-bold')
    if (unviewedIndicator) unviewedIndicator.remove()
    
    // Remove unviewed class
    notificationItem.classList.remove('unviewed')
  }

  updateDashboardCounts() {
    // Trigger count update in dashboard
    const dashboardController = document.querySelector('[data-controller*="dashboard-tabs"]')
    if (dashboardController && dashboardController.controller) {
      dashboardController.controller.updateCounts()
    }
    
    // Also update navbar notification badge
    this.updateNavbarBadge()
  }

  async updateNavbarBadge() {
    try {
      const response = await fetch('/dashboard/counts', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (response.ok) {
        const counts = await response.json()
        const navbarBadge = document.querySelector('.notification-badge')
        
        if (counts.unviewed_notifications_count > 0) {
          if (navbarBadge) {
            navbarBadge.textContent = counts.unviewed_notifications_count
          } else {
            // Create badge if it doesn't exist
            const dashboardLink = document.querySelector('a[href="/dashboard"]')
            if (dashboardLink) {
              const badge = document.createElement('span')
              badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger notification-badge'
              badge.textContent = counts.unviewed_notifications_count
              dashboardLink.appendChild(badge)
            }
          }
        } else {
          // Remove badge if no unviewed notifications
          if (navbarBadge) {
            navbarBadge.remove()
          }
        }
      }
    } catch (error) {
      console.error('Error updating navbar badge:', error)
    }
  }
}
