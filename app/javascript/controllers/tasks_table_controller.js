import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["table", "toggleBtn", "sortBtn"]

  connect() {
    this.initializeColumnVisibility()
    
    // Use event delegation on the table element - works even for dynamically shown/hidden buttons
    this.handleClick = this.handleClick.bind(this)
    this.element.addEventListener('click', this.handleClick)
    
    // Calculate width after a small delay to ensure DOM is ready
    setTimeout(() => {
      this.calculateAllColumnWidths()
    }, 100)
  }
  
  disconnect() {
    if (this.handleClick) {
      this.element.removeEventListener('click', this.handleClick)
    }
  }
  
  handleClick(event) {
    // Handle toggle button clicks (eye icons in column headers)
    const toggleBtn = event.target.closest('.toggle-btn')
    if (toggleBtn) {
      event.preventDefault()
      event.stopPropagation()
      this.toggleColumnFromButton(toggleBtn)
      return
    }
    
    // Handle capsule button clicks (in dropdown menu)
    const capsuleBtn = event.target.closest('.column-toggle-capsule')
    if (capsuleBtn) {
      event.preventDefault()
      event.stopPropagation()
      this.toggleColumnFromButton(capsuleBtn)
      return
    }
    
    // Handle sort button clicks
    const sortBtn = event.target.closest('.sort-btn')
    if (sortBtn) {
      event.preventDefault()
      const sortBy = sortBtn.getAttribute('data-sort')
      if (sortBy) {
        this.sortTable(sortBy)
      }
      return
    }
  }
  
  toggleColumnFromButton(button) {
    const column = button.dataset.column || button.getAttribute('data-column')
    if (!column) return
    
    const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
    const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
    
    if (!headerCell || columnData.length === 0) return
    
    // Check if column is currently hidden
    const isHidden = headerCell.style.display === 'none' || 
                    (columnData[0] && columnData[0].style.display === 'none')
    
    if (isHidden) {
      this.showColumn(column)
    } else {
      this.hideColumn(column)
    }
  }

  initializeColumnVisibility() {
    // Hide all columns except name by default
    const columnsToHide = ['start-date', 'end-date', 'status', 'responsible', 'accountable', 'priority', 'feature']
    
    columnsToHide.forEach(column => {
      // Hide header and data cells
      const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
      
      if (headerCell) {
        headerCell.style.display = 'none'
      }
      
      columnData.forEach(cell => {
        cell.style.display = 'none'
      })
    })
    
    // Initialize capsule button states
    this.updateCapsuleButtons()
  }

  showColumn(column) {
    const toggleButton = this.element.querySelector(`.toggle-btn[data-column="${column}"]`)
    if (!toggleButton) return
    
    const toggleIcon = toggleButton.querySelector('i')
    const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
    const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
    
    // Map column names to sort button data attributes
    const sortMapping = {
      'start-date': 'start_date',
      'end-date': 'end_date',
      'status': 'status',
      'responsible': 'responsible',
      'accountable': 'accountable',
      'priority': 'priority'
    }
    const sortButton = headerCell ? headerCell.querySelector(`[data-sort="${sortMapping[column]}"]`) : null
    
    // Show all data cells in this column (only tbody cells)
    columnData.forEach(cell => {
      cell.style.display = ''
    })
    
    // Show the entire header cell
    if (headerCell) {
      headerCell.style.display = ''
    }
    
    // Show sort button
    if (sortButton) {
      sortButton.style.setProperty('display', 'inline-block', 'important')
      // Update sort button state when it becomes visible
      this.updateSortButtons()
    }
    
    // Update toggle button icon to show it can be hidden (closed/crossed eye)
    if (toggleIcon) {
      toggleIcon.className = 'bi bi-eye-slash'
    }
    toggleButton.title = `Hide ${column.replace('-', ' ')} column`
    
    // Update capsule button state
    this.updateCapsuleButtons()
    
    // Check if all columns are visible and update container class
    this.updateTableContainerClass()
    
    // Recalculate column widths after showing a column
    setTimeout(() => {
      this.calculateAllColumnWidths()
    }, 50)
  }

  hideColumn(column) {
    const toggleButton = this.element.querySelector(`.toggle-btn[data-column="${column}"]`)
    if (!toggleButton) return
    
    const toggleIcon = toggleButton.querySelector('i')
    const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
    const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
    
    // Map column names to sort button data attributes
    const sortMapping = {
      'start-date': 'start_date',
      'end-date': 'end_date',
      'status': 'status',
      'responsible': 'responsible',
      'accountable': 'accountable',
      'priority': 'priority',
      'feature': 'feature'
    }
    const sortButton = headerCell ? headerCell.querySelector(`[data-sort="${sortMapping[column]}"]`) : null
    
    // Hide all data cells in this column (only tbody cells)
    columnData.forEach(cell => {
      cell.style.display = 'none'
    })
    
    // Hide the entire header cell
    if (headerCell) {
      headerCell.style.display = 'none'
    }
    
    // Hide sort button
    if (sortButton) {
      sortButton.style.setProperty('display', 'none', 'important')
    }
    
    // Update toggle button icon to show it can be shown (open eye)
    if (toggleIcon) {
      toggleIcon.className = 'bi bi-eye-fill'
    }
    toggleButton.title = `Show ${column.replace('-', ' ')} column`
    
    // Update capsule button state
    this.updateCapsuleButtons()
    
    // Check if all columns are visible and update container class
    this.updateTableContainerClass()
    
    // Recalculate column widths after hiding a column
    setTimeout(() => {
      this.calculateAllColumnWidths()
    }, 50)
  }

  async sortTable(sortBy) {
    // Get current URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const currentOrderBy = urlParams.get('order_by')
    const currentDirection = urlParams.get('direction') || 'asc'
    
    // Determine new direction
    let newDirection = 'asc'
    if (currentOrderBy === sortBy && currentDirection === 'asc') {
      newDirection = 'desc'
    }
    
    // Update URL parameters
    urlParams.set('order_by', sortBy)
    urlParams.set('direction', newDirection)
    
    // Update the URL without page refresh
    const newUrl = window.location.pathname + '?' + urlParams.toString()
    window.history.pushState({}, '', newUrl)
    
    try {
      // Fetch the sorted table
      const response = await fetch(newUrl, {
        headers: {
          'Accept': 'text/html',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        
        // Find the new table content
        const newTable = doc.querySelector('.features-table-container')
        const currentTable = this.element
        
        if (newTable && currentTable) {
          // Store current column visibility states
          const visibleColumns = this.getVisibleColumns()
          
          // Replace the table content
          currentTable.innerHTML = newTable.innerHTML
          
          // Re-initialize the controller for the new content
          this.initializeColumnVisibility()
          
          // Restore column visibility states
          this.restoreColumnVisibility(visibleColumns)
          this.dispatch('refreshed', { bubbles: true })
        }
      } else {
        // Fallback to full page reload if fetch fails
        window.location.href = newUrl
      }
    } catch (error) {
      console.error('Error sorting table:', error)
      // Fallback to full page reload on error
      window.location.href = newUrl
    }
  }

  getVisibleColumns() {
    const visibleColumns = []
    const columnsToCheck = ['start-date', 'end-date', 'status', 'responsible', 'accountable', 'priority', 'feature']
    
    columnsToCheck.forEach(column => {
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
      const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
      if (columnData.length > 0 && columnData[0].style.display !== 'none' &&
          headerCell && headerCell.style.display !== 'none') {
        visibleColumns.push(column)
      }
    })
    
    return visibleColumns
  }

  restoreColumnVisibility(visibleColumns) {
    // First, hide all columns
    const columnsToHide = ['start-date', 'end-date', 'status', 'responsible', 'accountable', 'priority', 'feature']
    columnsToHide.forEach(column => {
      const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
      
      if (headerCell) {
        headerCell.style.display = 'none'
      }
      columnData.forEach(cell => {
        cell.style.display = 'none'
      })
    })
    
    // Then, show only the columns that were visible before
    visibleColumns.forEach(column => {
      this.showColumn(column)
    })
  }

  updateSortButtons() {
    const urlParams = new URLSearchParams(window.location.search)
    const currentOrderBy = urlParams.get('order_by')
    const currentDirection = urlParams.get('direction') || 'asc'
    
    // Reset all sort buttons
    this.element.querySelectorAll('.sort-btn').forEach(button => {
      if (button.style.display === 'inline-block' || button.style.getPropertyValue('display') === 'inline-block') {
        button.classList.remove('active')
        const icon = button.querySelector('i')
        if (icon) {
          icon.className = 'bi bi-sort-down'
        }
      }
    })
    
    // Set active sort button
    if (currentOrderBy) {
      const activeButton = this.element.querySelector(`[data-sort="${currentOrderBy}"]`)
      if (activeButton && (activeButton.style.display === 'inline-block' || activeButton.style.getPropertyValue('display') === 'inline-block')) {
        activeButton.classList.add('active')
        const icon = activeButton.querySelector('i')
        if (icon) {
          icon.className = currentDirection === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down'
        }
      }
    }
  }

  updateCapsuleButtons() {
    this.element.querySelectorAll('.column-toggle-capsule').forEach(button => {
      const column = button.getAttribute('data-column')
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
      const headerCell = this.element.querySelector(`thead th[data-column="${column}"]`)
      const icon = button.querySelector('i')
      
      // Check if column is visible (not display: none)
      const isVisible = columnData.length > 0 && columnData[0].style.display !== 'none' && 
                       headerCell && headerCell.style.display !== 'none'
      
      if (isVisible) {
        button.classList.add('active')
        button.title = `Hide ${column.replace('-', ' ')} column`
        if (icon) {
          icon.className = 'bi bi-eye-slash-fill'
        }
      } else {
        button.classList.remove('active')
        button.title = `Show ${column.replace('-', ' ')} column`
        if (icon) {
          icon.className = 'bi bi-eye-fill'
        }
      }
    })
  }

  updateTableContainerClass() {
    const container = this.element
    const allColumns = ['start-date', 'end-date', 'status', 'responsible', 'accountable', 'priority', 'feature']
    
    const allVisible = allColumns.every(column => {
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column}"]`)
      return columnData.length > 0 && columnData[0].style.display !== 'none'
    })
    
    if (allVisible) {
      container.classList.add('all-columns-visible')
    } else {
      container.classList.remove('all-columns-visible')
    }
  }

  calculateColumnWidth(columnClass, columnName, fontSize, fontWeight) {
    const tempElement = document.createElement('span')
    tempElement.style.visibility = 'hidden'
    tempElement.style.position = 'absolute'
    tempElement.style.whiteSpace = 'nowrap'
    tempElement.style.fontSize = fontSize
    tempElement.style.fontWeight = fontWeight
    tempElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    document.body.appendChild(tempElement)
    
    let maxWidth = 0
    
    const headerCell = this.element.querySelector(`thead .${columnClass}`)
    if (headerCell) {
      tempElement.textContent = columnName
      const headerWidth = tempElement.offsetWidth
      maxWidth = Math.max(maxWidth, headerWidth)
    }
    
    const bodyCells = this.element.querySelectorAll(`tbody .${columnClass}`)
    bodyCells.forEach(cell => {
      const text = cell.textContent.trim()
      tempElement.textContent = text
      const textWidth = tempElement.offsetWidth
      maxWidth = Math.max(maxWidth, textWidth)
    })
    
    document.body.removeChild(tempElement)
    
    const optimalWidth = maxWidth + 32
    
    if (headerCell) {
      headerCell.style.width = optimalWidth + 'px'
      headerCell.style.minWidth = optimalWidth + 'px'
      headerCell.style.maxWidth = optimalWidth + 'px'
    }
    
    bodyCells.forEach(cell => {
      cell.style.width = optimalWidth + 'px'
      cell.style.minWidth = optimalWidth + 'px'
      cell.style.maxWidth = optimalWidth + 'px'
    })
  }

  calculateAllColumnWidths() {
    this.calculateColumnWidth('column-name', 'Name', '0.95rem', '600')
    
    const columns = [
      { class: 'column-toggle', name: 'Start Date', dataColumn: 'start-date' },
      { class: 'column-toggle', name: 'End Date', dataColumn: 'end-date' },
      { class: 'column-toggle', name: 'Status', dataColumn: 'status' },
      { class: 'column-toggle', name: 'Responsible', dataColumn: 'responsible' },
      { class: 'column-toggle', name: 'Accountable', dataColumn: 'accountable' },
      { class: 'column-toggle', name: 'Priority', dataColumn: 'priority' },
      { class: 'column-toggle', name: 'Feature', dataColumn: 'feature' }
    ]
    
    columns.forEach(column => {
      const columnData = this.element.querySelectorAll(`tbody [data-column="${column.dataColumn}"]`)
      const headerCell = this.element.querySelector(`thead th[data-column="${column.dataColumn}"]`)
      if (columnData.length > 0 && columnData[0].style.display !== 'none' &&
          headerCell && headerCell.style.display !== 'none') {
        this.calculateColumnWidth(column.class, column.name, '0.95rem', '400')
      }
    })
  }
}

