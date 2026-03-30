import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["createBtn"]
  static values = { newUrl: String }

  connect() {
    this.update()
  }

  update() {
    if (!this.hasCreateBtnTarget) return
    const boxes = this.element.querySelectorAll("input[type=\"checkbox\"][data-task-id]")
    const ids = Array.from(boxes).filter((cb) => cb.checked).map((cb) => cb.dataset.taskId)
    if (ids.length === 0) {
      this.createBtnTarget.style.display = "none"
      this.createBtnTarget.removeAttribute("href")
      return
    }
    const q = new URLSearchParams()
    ids.forEach((id) => q.append("task_ids[]", id))
    this.createBtnTarget.href = `${this.newUrlValue}?${q.toString()}`
    this.createBtnTarget.style.display = "inline-block"
  }
}
