import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    // Update counts every 30 seconds to keep them fresh
    this.countUpdateInterval = setInterval(() => {
      this.updateCounts()
    }, 30000)
  }

  disconnect() {
    if (this.countUpdateInterval) {
      clearInterval(this.countUpdateInterval)
    }
  }
  switchTab(event) {
    event.preventDefault()
    const tabName = event.currentTarget.dataset.tab
    
    // Update active tab button immediately for better UX
    this.updateActiveTab(event.currentTarget)
    
    // Load tab content via AJAX
    this.loadTabContent(tabName)
    
    // Update URL without page reload
    const url = new URL(window.location)
    url.searchParams.set('tab', tabName)
    window.history.pushState({}, '', url)
  }

  async loadTabContent(tabName) {
    try {
      const response = await fetch(`/dashboard/tab/${tabName}`, {
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        const tabPanel = this.element.querySelector(`[data-tab-panel="${tabName}"]`)
        if (tabPanel) {
          tabPanel.innerHTML = html
          this.showTab(tabName)
        }
        
        // Update counts after loading content
        this.updateCounts()
      } else {
        console.error('Failed to load tab content')
      }
    } catch (error) {
      console.error('Error loading tab content:', error)
    }
  }

  async updateCounts() {
    try {
      const response = await fetch('/dashboard/counts', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (response.ok) {
        const counts = await response.json()
        
        // Update notification count
        const notificationCount = this.element.querySelector('.notification-count')
        if (notificationCount) {
          notificationCount.textContent = counts.unviewed_notifications_count
        }
        
        // Update contributing projects count
        const contributingCount = this.element.querySelector('[data-tab="contributing"] .tab-count')
        if (contributingCount) {
          contributingCount.textContent = counts.contributing_projects_count
        }
        
        // Update my projects count
        const myProjectsCount = this.element.querySelector('[data-tab="my_projects"] .tab-count')
        if (myProjectsCount) {
          myProjectsCount.textContent = counts.my_projects_count
        }
        
        // Update navbar notification badge
        this.updateNavbarBadge(counts.unviewed_notifications_count)
      }
    } catch (error) {
      console.error('Error updating counts:', error)
    }
  }

  updateNavbarBadge(count) {
    const navbarBadge = document.querySelector('.notification-badge')
    const dashboardLink = document.querySelector('a[href="/dashboard"]')
    
    if (count > 0) {
      if (navbarBadge) {
        navbarBadge.textContent = count
      } else if (dashboardLink) {
        // Create badge if it doesn't exist
        const badge = document.createElement('span')
        badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger notification-badge'
        badge.textContent = count
        badge.innerHTML = `${count}<span class="visually-hidden">unviewed notifications</span>`
        dashboardLink.appendChild(badge)
      }
    } else {
      // Remove badge if no unviewed notifications
      if (navbarBadge) {
        navbarBadge.remove()
      }
    }
  }

  // These methods are kept for compatibility but may not be needed with Turbo
  showTab(tabName) {
    // Hide all tab panels
    const allPanels = this.element.querySelectorAll('.tab-panel')
    allPanels.forEach(panel => {
      panel.classList.remove('active')
    })
    
    // Show selected tab panel
    const activePanel = this.element.querySelector(`[data-tab-panel="${tabName}"]`)
    if (activePanel) {
      activePanel.classList.add('active')
    }
  }

  updateActiveTab(activeButton) {
    // Remove active class from all tab buttons
    const allButtons = this.element.querySelectorAll('.tab-btn')
    allButtons.forEach(btn => {
      btn.classList.remove('active')
    })
    
    // Add active class to clicked button
    activeButton.classList.add('active')
  }
}
