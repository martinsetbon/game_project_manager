import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tbody", "row"]
  static values = { rowTemplateId: { type: String, default: "feature-bulk-form-row-template" } }

  addRow() {
    const tpl = document.getElementById(this.rowTemplateIdValue)
    if (!tpl || !this.hasTbodyTarget) return
    const node = tpl.content.cloneNode(true)
    this.tbodyTarget.appendChild(node)
  }

  removeRow(event) {
    const tr = event.target.closest("tr")
    if (!tr || !this.tbodyTarget.contains(tr)) return
    if (this.tbodyTarget.querySelectorAll("tr").length <= 1) return
    tr.remove()
  }
}
