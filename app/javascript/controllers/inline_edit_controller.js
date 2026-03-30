import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "fileInput", "confirmInput", "form", "arrayContainer", "arrayInput"]

  edit(event) {
    event.preventDefault()
    const field = this.element
    const display = field.querySelector('.field-display')
    const edit = field.querySelector('.field-edit')
    
    // Hide display, show edit
    display.style.display = 'none'
    edit.style.display = 'block'
    
    // Focus on input
    if (this.hasInputTarget) {
      this.inputTarget.focus()
    }
  }

  cancel(event) {
    event.preventDefault()
    const field = this.element
    const display = field.querySelector('.field-display')
    const edit = field.querySelector('.field-edit')
    
    // Show display, hide edit
    display.style.display = 'block'
    edit.style.display = 'none'
  }

  async save(event) {
    event.preventDefault()
    const field = this.element
    const fieldName = field.dataset.field
    let value = null

    // Handle password with confirmation
    if (fieldName === 'password') {
      if (this.hasConfirmInputTarget && this.hasInputTarget) {
        const password = this.inputTarget.value
        const passwordConfirmation = this.confirmInputTarget.value
        
        if (password !== passwordConfirmation) {
          alert('Passwords do not match')
          return
        }
        
        if (password.length < 6) {
          alert('Password must be at least 6 characters')
          return
        }
        
        value = password
      }
    }
    // Handle file uploads (avatar, resume)
    else if (field.classList.contains('profile-field-file')) {
      // File uploads are handled by form submission, not here
      // The form will submit normally
      return
    }
    // Handle array fields (skills, speaking_languages)
    else if (field.classList.contains('profile-field-array')) {
      // This is handled by saveArray method
      return
    }
    // Handle regular text fields
    else {
      if (this.hasInputTarget) {
        value = this.inputTarget.value
      }
    }

    console.log('Saving field:', fieldName, 'with value:', value)

    // Determine if this is a project/feature/task update or profile update
    const isProjectField = field.closest('.project-folder') !== null || field.closest('.feature-folder-content') !== null
    const updateUrl = isProjectField
      ? window.location.pathname
      : '/profile/update_field'
    
    // For feature, task, or project fields, ensure we're using the correct update path
    const featurePath = window.location.pathname.match(/\/projects\/\d+\/project_features\/\d+/)
    const taskPath = window.location.pathname.match(/\/projects\/\d+\/tasks\/\d+/)
    const projectPath = window.location.pathname.match(/^\/projects\/\d+$/)
    const finalUpdateUrl = featurePath || taskPath || projectPath ? window.location.pathname : updateUrl

    console.log('Update URL:', finalUpdateUrl, 'isFeature:', !!featurePath, 'isTask:', !!taskPath, 'isProject:', !!projectPath)

    // Save the value
    if (value !== null) {
      try {
        const requestBody = {
          field: fieldName,
          value: value
        }
        console.log('Sending request:', requestBody)
        
        const makeRequest = async (overrideBody = {}) => {
          return fetch(finalUpdateUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
              'Accept': 'application/json'
            },
            body: JSON.stringify({ ...requestBody, ...overrideBody })
          })
        }

        let response = await makeRequest()

        console.log('Save response status:', response.status)
        
        if (response.status === 409) {
          const data = await response.json()
          if (data.status === 'overlap_warning') {
            const isLinkedShift = data.overlap_context === 'linked_shift'
            let proceed
            if (isLinkedShift) {
              proceed = window.confirm(`${data.message}\n\nOK = Proceed anyway (tasks will overlap)\nCancel = Break the link`)
            } else {
              proceed = window.confirm(`${data.message}\n\nDo you want to proceed anyway?`)
            }
            if (proceed) {
              const overlapFlags = isLinkedShift ? { link_decision: 'shift', proceed_linked_overlap: true } : { proceed: true }
              response = await makeRequest(overlapFlags)
            } else if (isLinkedShift) {
              response = await makeRequest({ link_decision: 'shift', overlap_decision: 'break' })
            } else {
              return
            }
          } else if (data.status === 'linked_shift_warning' || data.status === 'linked_shift_forward_warning') {
            const moveLinked = window.confirm(
              `${data.message}\n\n` +
                'OK = Move all linked tasks with this one.\n' +
                'Cancel = Abort this save; dates and links stay unchanged.'
            )
            if (moveLinked) {
              const tasksToMove = data.tasks_to_move || data.linked_tasks || []
              const taskIds = tasksToMove.map((t) => t.id)
              response = await makeRequest({ link_decision: 'shift', task_ids_to_shift: taskIds })
            } else {
              return
            }
          } else if (data.status === 'project_start_warning') {
            const proceed = window.confirm(`${data.message}\n\nDo you want to proceed anyway?`)
            if (proceed) {
              response = await makeRequest({ proceed_project_start: true })
            } else {
              return
            }
          } else if (data.status === 'linked_warning') {
            const align = window.confirm(`${data.message}\n\nOK = Align linked tasks\nCancel = More options`)
            if (align) {
              response = await makeRequest({ link_decision: 'align' })
            } else {
              const breakLink = window.confirm('Break the link instead?')
              if (breakLink) {
                response = await makeRequest({ link_decision: 'break' })
              } else {
                return
              }
            }
          }
        }

          if (response.ok) {
            const data = await response.json()
          console.log('Save response data:', data)
          
          // Check if save was actually successful
          if (data.status !== 'success') {
            alert('Error: ' + (data.errors ? data.errors.join(', ') : 'Failed to save'))
            return
          }
          
          // Update display value
          const displayValue = field.querySelector('.field-value')
          console.log('Found displayValue:', displayValue)
          
          if (!displayValue) {
            console.error('Could not find .field-value element!')
            alert('Error: Could not update display')
            return
          }
          
          if (fieldName === 'password') {
            displayValue.textContent = '••••••••'
          } else if (fieldName === 'start_date' || fieldName === 'end_date') {
            // Update date display
            console.log('Updating date display for', fieldName)
            console.log('Data received:', data)
            console.log('Value received:', data.value)
            console.log('Formatted value:', data.formatted_value)
            
            // The structure is: <div class="field-value date-value"><i></i><span>date</span></div>
            const dateSpan = displayValue.querySelector('span')
            console.log('Found dateSpan:', dateSpan, 'HTML:', displayValue.innerHTML)
            
            if (dateSpan) {
              // Use formatted value from server response
              const formattedValue = data.formatted_value || data.value || (value ? new Date(value).toISOString().split('T')[0] : 'Not set')
              console.log('Setting dateSpan textContent to:', formattedValue)
              dateSpan.textContent = formattedValue
              console.log('After update, dateSpan.textContent:', dateSpan.textContent)
            } else {
              // Fallback - reconstruct the structure
              console.warn('DateSpan not found, reconstructing HTML')
              const formattedValue = data.formatted_value || data.value || (value ? new Date(value).toISOString().split('T')[0] : 'Not set')
              displayValue.innerHTML = `<i class="bi bi-calendar"></i><span>${formattedValue}</span>`
            }
          } else if (fieldName === 'status') {
            // Update status badge
            const statusBadge = displayValue.querySelector('.feature-status-badge')
            if (statusBadge) {
              // Remove old status class
              statusBadge.classList.remove('status-not_started', 'status-work_in_progress', 'status-stand_by', 'status-job_done')
              // Add new status class
              statusBadge.classList.add(`status-${value}`)
              // Update text content
              statusBadge.textContent = data.value || value
            }
          } else if (fieldName === 'responsible_user_id' || fieldName === 'accountable_user_id') {
            // Update contributor display
            const displayTarget = field.querySelector('[data-inline-edit-target="display"]')
            if (displayTarget) {
              if (value && value !== '0' && data.value && data.value !== 'Not assigned') {
                displayTarget.innerHTML = `
                  <div class="contributor-item">
                    <span class="contributor-name">${data.value.split(' - ')[0]}</span>
                    ${data.value.includes(' - ') ? `<span class="contributor-job">${data.value.split(' - ')[1]}</span>` : ''}
                  </div>
                `
              } else {
                displayTarget.innerHTML = '<span class="no-contributors">Not assigned</span>'
              }
            }
          } else if (fieldName === 'description') {
            displayValue.textContent = value || 'No description'
          } else {
            displayValue.textContent = data.value || value || 'Not set'
          }
          
          // Hide edit, show display
          this.cancel(event)

          // For project date changes, refresh to update calendar view
          if ((fieldName === 'start_date' || fieldName === 'end_date') && projectPath) {
            window.location.reload()
            return
          }

          if ((fieldName === 'start_date' || fieldName === 'end_date' || fieldName === 'duration') && taskPath) {
            let startText = document.querySelector('[data-field="start_date"] .field-value span')?.textContent
            let endText = document.querySelector('[data-field="end_date"] .field-value span')?.textContent
            if (fieldName === 'duration' && data?.start_date && data?.end_date) {
              startText = data.start_date
              endText = data.end_date
              const endDateField = document.querySelector('[data-field="end_date"] .field-value span')
              if (endDateField) endDateField.textContent = data.end_date
            }
            if (startText && endText) {
              document.dispatchEvent(new CustomEvent('task:date-updated', {
                detail: {
                  start_date: startText,
                  end_date: endText
                }
              }))
            }
            if (data?.segments) {
              document.dispatchEvent(new CustomEvent('task:segments-updated', {
                detail: {
                  segments: data.segments,
                  checkpoints: data.checkpoints || []
                }
              }))
            }
          }
          
          if (data?.linked_notice) {
            alert(data.linked_notice)
          }
        } else {
          const data = await response.json()
          alert('Error: ' + (data.errors ? data.errors.join(', ') : 'Failed to save'))
        }
      } catch (error) {
        alert('Error saving: ' + error.message)
      }
    }
  }

  async saveBudget(event) {
    event.preventDefault()
    const field = this.element
    const budgetInput = field.querySelector('[data-inline-edit-target="input"]')
    const currencyInput = field.querySelector('[data-inline-edit-target="currencyInput"]')
    
    if (!budgetInput || !currencyInput) return

    const budget = budgetInput.value
    const currency = currencyInput.value
    const updateUrl = window.location.pathname

    try {
      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          field: 'budget',
          value: budget,
          currency: currency
        })
      })

      if (response.ok) {
        // Update display value
        const displayValue = field.querySelector('.field-value')
        displayValue.textContent = `${currency} ${budget || 'Not set'}`
        
        // Hide edit, show display
        this.cancel(event)
      } else {
        const data = await response.json()
        alert('Error: ' + (data.errors ? data.errors.join(', ') : 'Failed to save'))
      }
    } catch (error) {
      alert('Error saving: ' + error.message)
    }
  }

  submitBackgroundForm(event) {
    const form = event.target.closest('form')
    if (form && event.target.files.length > 0) {
      form.submit()
    }
  }

  addArrayItem(event) {
    event.preventDefault()
    const container = this.arrayContainerTarget
    const newItem = document.createElement('div')
    newItem.className = 'array-item'
    newItem.innerHTML = `
      <input type="text" class="form-control" value="" data-inline-edit-target="arrayInput" placeholder="Enter value">
      <button type="button" class="btn btn-sm btn-danger remove-item" data-action="click->inline-edit#removeArrayItem">
        <i class="bi bi-trash"></i>
      </button>
    `
    container.appendChild(newItem)
  }

  removeArrayItem(event) {
    event.preventDefault()
    const item = event.currentTarget.closest('.array-item')
    if (item) {
      item.remove()
    }
  }

  async saveArray(event) {
    event.preventDefault()
    const field = this.element
    const fieldName = field.dataset.field
    const inputs = field.querySelectorAll('[data-inline-edit-target="arrayInput"]')
    const values = Array.from(inputs)
      .map(input => input.value.trim())
      .filter(value => value.length > 0)

    try {
      const response = await fetch('/profile/update_field', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          field: fieldName,
          value: values
        })
      })

      if (response.ok) {
        const data = await response.json()
        // Update display
        const displayValue = field.querySelector('.field-value')
        if (values.length > 0) {
          const badgeClass = fieldName === 'skills' ? 'skill-badge' : 'language-badge'
          displayValue.innerHTML = values.map(val => 
            `<span class="badge ${badgeClass}">${val}</span>`
          ).join('')
        } else {
          displayValue.innerHTML = `<span>No ${fieldName.replace('_', ' ')} added</span>`
        }
        
        // Hide edit, show display
        this.cancel(event)
      } else {
        const data = await response.json()
        alert('Error: ' + (data.errors ? data.errors.join(', ') : 'Failed to save'))
      }
    } catch (error) {
      alert('Error saving: ' + error.message)
    }
  }
}

