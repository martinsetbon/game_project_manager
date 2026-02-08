import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["cardsView", "tableView"]

  connect() {
    this.currentView = 'cards' // 'cards' or 'table'
    this.activeFilters = new Set()
    this.myFeaturesOnly = false
    
    // Set default view to cards
    this.showCardsView()
    this.updateViewToggle()
  }

  toggleView() {
    if (this.currentView === 'cards') {
      this.currentView = 'table'
      this.showTableView()
    } else {
      this.currentView = 'cards'
      this.showCardsView()
    }
    this.updateViewToggle()
  }

  showCardsView() {
    // Hide table view
    const tableView = this.element.querySelector('.features-table-container')
    if (tableView) {
      tableView.style.display = 'none'
    }
    
    // Show cards view
    const cardsView = this.element.querySelector('.features-cards-container')
    if (cardsView) {
      cardsView.style.display = 'block'
    }
    this.currentView = 'cards'
  }

  showTableView() {
    // Hide cards view
    const cardsView = this.element.querySelector('.features-cards-container')
    if (cardsView) {
      cardsView.style.display = 'none'
    }
    
    // Show table view
    const tableView = this.element.querySelector('.features-table-container')
    if (tableView) {
      tableView.style.display = 'block'
    }
    this.currentView = 'table'
  }

  updateViewToggle() {
    const toggle = this.element.querySelector('.switch-view-toggle')
    if (!toggle) return
    
    if (this.currentView === 'cards') {
      toggle.classList.remove('table-view')
      toggle.classList.add('cards-view')
    } else {
      toggle.classList.remove('cards-view')
      toggle.classList.add('table-view')
    }
  }

  toggleStatusFilter(event) {
    const button = event.currentTarget
    const status = button.dataset.status
    
    if (button.classList.contains('active')) {
      button.classList.remove('active')
      this.activeFilters.delete(status)
    } else {
      button.classList.add('active')
      this.activeFilters.add(status)
    }
    
    this.applyFilters()
  }

  toggleMyFeaturesFilter(event) {
    const button = event.currentTarget
    this.myFeaturesOnly = !this.myFeaturesOnly
    
    if (this.myFeaturesOnly) {
      button.classList.add('active')
    } else {
      button.classList.remove('active')
    }
    
    this.applyFilters()
  }

  applyFilters() {
    if (this.currentView === 'cards') {
      this.filterCards()
    } else {
      this.filterTable()
    }
  }

  filterCards() {
    const cards = this.element.querySelectorAll('.feature-card')
    
    cards.forEach(card => {
      const cardStatus = this.getCardStatus(card)
      const isMyFeature = card.dataset.myFeature === 'true'
      
      let shouldShow = true
      
      // Filter by status
      if (this.activeFilters.size > 0 && !this.activeFilters.has(cardStatus)) {
        shouldShow = false
      }
      
      // Filter by my features
      if (this.myFeaturesOnly && !isMyFeature) {
        shouldShow = false
      }
      
      const wrapper = card.closest('.feature-card-wrapper')
      if (wrapper) {
        wrapper.style.display = shouldShow ? 'flex' : 'none'
      }
    })
  }

  filterTable() {
    const rows = this.element.querySelectorAll('tbody tr')
    
    rows.forEach(row => {
      const rowStatus = this.getRowStatus(row)
      const isMyFeature = row.dataset.myFeature === 'true'
      
      let shouldShow = true
      
      // Filter by status
      if (this.activeFilters.size > 0 && !this.activeFilters.has(rowStatus)) {
        shouldShow = false
      }
      
      // Filter by my features
      if (this.myFeaturesOnly && !isMyFeature) {
        shouldShow = false
      }
      
      row.style.display = shouldShow ? '' : 'none'
    })
  }

  getCardStatus(card) {
    const classList = Array.from(card.classList)
    const statusClass = classList.find(cls => cls.startsWith('status-'))
    return statusClass ? statusClass.replace('status-', '') : null
  }

  getRowStatus(row) {
    const statusCell = row.querySelector('[data-column="status"]')
    if (statusCell) {
      const statusText = statusCell.textContent.trim().toLowerCase()
      if (statusText === 'on going' || statusText.includes('going')) {
        return 'work_in_progress'
      } else if (statusText === 'job done' || statusText.includes('done')) {
        return 'job_done'
      } else if (statusText === 'not started') {
        return 'not_started'
      } else if (statusText.includes('stand') || statusText.includes('by')) {
        return 'stand_by'
      }
      return statusText.replace(' ', '_')
    }
    return null
  }

  addStatusFilterListeners() {
    // Add event listeners to status filter checkboxes
    document.querySelectorAll('input[name="statuses[]"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.filterByStatus()
      })
    })
    
    // Add event listener to My Features checkbox
    const myFeaturesCheckbox = document.querySelector('input[name="my_features"]')
    if (myFeaturesCheckbox) {
      myFeaturesCheckbox.addEventListener('change', () => {
        this.filterByMyFeatures()
      })
    }
  }

  filterByStatus() {
    // Get selected statuses
    const selectedStatuses = Array.from(document.querySelectorAll('input[name="statuses[]"]:checked'))
      .map(checkbox => checkbox.value)
    
    // Filter cards view
    this.filterCardsView(selectedStatuses)
    
    // Filter table view
    this.filterTableView(selectedStatuses)
  }

  filterCardsView(selectedStatuses) {
    const cards = document.querySelectorAll('.feature-card')
    
    cards.forEach(card => {
      const cardStatus = this.getCardStatus(card)
      
      if (selectedStatuses.length === 0 || selectedStatuses.includes(cardStatus)) {
        card.style.display = 'flex'
      } else {
        card.style.display = 'none'
      }
    })
  }

  filterTableView(selectedStatuses) {
    const rows = document.querySelectorAll('tbody tr')
    
    rows.forEach(row => {
      const rowStatus = this.getRowStatus(row)
      console.log('Row status:', rowStatus, 'Selected statuses:', selectedStatuses)
      
      if (selectedStatuses.length === 0 || selectedStatuses.includes(rowStatus)) {
        row.style.display = ''
      } else {
        row.style.display = 'none'
      }
    })
  }

  getCardStatus(card) {
    // Extract status from card's class list
    const classList = Array.from(card.classList)
    const statusClass = classList.find(cls => cls.startsWith('status-'))
    return statusClass ? statusClass.replace('status-', '') : null
  }

  getRowStatus(row) {
    // Extract status from row's data attribute or class
    const statusCell = row.querySelector('[data-column="status"]')
    if (statusCell) {
      const statusText = statusCell.textContent.trim().toLowerCase()
      // Map display text to actual status values
      if (statusText === 'on going' || statusText === 'work in progress') {
        return 'work_in_progress'
      } else if (statusText === 'job done' || statusText === 'done') {
        return 'job_done'
      } else if (statusText === 'not started') {
        return 'not_started'
      }
      return statusText.replace(' ', '_')
    }
    return null
  }

  filterByMyFeatures() {
    // Get the My Features checkbox state
    const myFeaturesCheckbox = document.querySelector('input[name="my_features"]')
    const showMyFeaturesOnly = myFeaturesCheckbox && myFeaturesCheckbox.checked
    
    // Filter cards view
    this.filterCardsViewByMyFeatures(showMyFeaturesOnly)
    
    // Filter table view
    this.filterTableViewByMyFeatures(showMyFeaturesOnly)
  }

  filterCardsViewByMyFeatures(showMyFeaturesOnly) {
    const cards = document.querySelectorAll('.feature-card')
    
    cards.forEach(card => {
      const isMyFeature = card.dataset.myFeature === 'true'
      
      if (!showMyFeaturesOnly || isMyFeature) {
        card.style.display = 'flex'
      } else {
        card.style.display = 'none'
      }
    })
  }

  filterTableViewByMyFeatures(showMyFeaturesOnly) {
    const rows = document.querySelectorAll('tbody tr')
    
    rows.forEach(row => {
      const isMyFeature = row.dataset.myFeature === 'true'
      
      if (!showMyFeaturesOnly || isMyFeature) {
        row.style.display = ''
      } else {
        row.style.display = 'none'
      }
    })
  }
}
