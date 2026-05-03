import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["createBtn", "helpText", "card", "row", "checkbox"]
  static values = { newUrl: String }

  connect() {
    this.selectionMode = false
    this.update()
  }

  toggleMode(event) {
    event.preventDefault()

    if (!this.selectionMode) {
      this.selectionMode = true
      this.update()
      return
    }

    const ids = this.selectedTaskIds()
    if (ids.length === 0) {
      window.alert("Please select the tasks you want to group.")
      return
    }

    window.location.href = this.urlForSelectedTasks(ids)
  }

  toggleCard(event) {
    if (!this.selectionMode) return

    event.preventDefault()
    const card = event.currentTarget
    if (!this.isUngrouped(card)) return

    card.classList.toggle("task-feature-selection-selected")
    this.syncCheckbox(card.dataset.taskId, card.classList.contains("task-feature-selection-selected"))
    this.update()
  }

  toggleRow(event) {
    if (!this.selectionMode) return
    if (event.target.matches("input[type=\"checkbox\"]")) return

    const row = event.currentTarget
    if (!this.isUngrouped(row)) return

    const checkbox = row.querySelector("input[type=\"checkbox\"][data-task-id]")
    if (!checkbox || checkbox.disabled) return
    checkbox.checked = !checkbox.checked
    this.syncCard(checkbox.dataset.taskId, checkbox.checked)
    this.update()
  }

  toggleCheckbox(event) {
    const checkbox = event.currentTarget
    this.syncCard(checkbox.dataset.taskId, checkbox.checked)
    this.update()
  }

  update() {
    if (!this.hasCreateBtnTarget) return

    this.element.classList.toggle("task-feature-selection-mode", this.selectionMode)
    this.helpTextTargets.forEach((target) => {
      target.style.display = this.selectionMode ? "block" : "none"
    })

    this.cardTargets.forEach((card) => {
      const selectable = this.selectionMode && this.isUngrouped(card)
      card.classList.toggle("task-feature-selection-selectable", selectable)
      card.classList.toggle("task-feature-selection-disabled", this.selectionMode && !selectable)
    })

    this.rowTargets.forEach((row) => {
      const selectable = this.selectionMode && this.isUngrouped(row)
      row.classList.toggle("task-feature-selection-selectable", selectable)
      row.classList.toggle("task-feature-selection-disabled", this.selectionMode && !selectable)
    })

    this.checkboxTargets.forEach((checkbox) => {
      const selectable = this.selectionMode && this.isUngrouped(checkbox.closest("tr"))
      checkbox.disabled = !selectable
      if (!selectable) checkbox.checked = false
    })

    const selectedCount = this.selectedTaskIds().length
    this.createBtnTarget.textContent = this.selectionMode
      ? `Group those tasks and make feature${selectedCount > 0 ? ` (${selectedCount})` : ""}`
      : "Group tasks into a feature"
    this.createBtnTarget.classList.toggle("btn-warning", this.selectionMode)
    this.createBtnTarget.classList.toggle("btn-outline-warning", !this.selectionMode)
    this.createBtnTarget.setAttribute("title", this.selectionMode ? "Please select the tasks you want to group." : "")
  }

  selectedTaskIds() {
    const ids = new Set()
    this.cardTargets
      .filter((card) => card.classList.contains("task-feature-selection-selected"))
      .forEach((card) => ids.add(card.dataset.taskId))
    this.checkboxTargets
      .filter((checkbox) => checkbox.checked && !checkbox.disabled)
      .forEach((checkbox) => ids.add(checkbox.dataset.taskId))
    return Array.from(ids)
  }

  urlForSelectedTasks(ids) {
    const q = new URLSearchParams()
    ids.forEach((id) => q.append("task_ids[]", id))
    return `${this.newUrlValue}?${q.toString()}`
  }

  isUngrouped(element) {
    return element?.dataset?.featureId === "none"
  }

  syncCheckbox(taskId, checked) {
    this.checkboxTargets
      .filter((checkbox) => checkbox.dataset.taskId === taskId && !checkbox.disabled)
      .forEach((checkbox) => {
        checkbox.checked = checked
      })
  }

  syncCard(taskId, checked) {
    this.cardTargets
      .filter((card) => card.dataset.taskId === taskId && this.isUngrouped(card))
      .forEach((card) => {
        card.classList.toggle("task-feature-selection-selected", checked)
      })
  }
}
