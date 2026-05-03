import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tbody", "row"]
  static values = {
    rowTemplateId: { type: String, default: "feature-bulk-form-row-template" },
    confirmOverlaps: { type: Boolean, default: false }
  }

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

  async submit(event) {
    if (!this.confirmOverlapsValue) return

    event.preventDefault()
    await this.submitForm(event.target, this.submitterFor(event))
  }

  async submitForm(form, submitter, proceedOverlaps = false) {
    const formData = submitter ? new FormData(form, submitter) : new FormData(form)
    if (proceedOverlaps) formData.set("proceed_overlaps", "true")
    if (submitter?.dataset?.bulkCreateMode) {
      formData.set("bulk_create_mode", submitter.dataset.bulkCreateMode)
    }

    let response
    let data
    try {
      response = await fetch(form.action, {
        method: form.method || "POST",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
        },
        body: formData
      })
      data = await response.json()
    } catch (error) {
      window.alert("Could not create feature. Please try again.")
      return
    }

    if (response.status === 409 && data.status === "overlap_warning") {
      const overlaps = (data.overlaps || []).join("\n")
      const message = `Creating this feature will make some tasks overlap:\n\n${overlaps}\n\nDo you want to proceed anyway and allow overlaps?`
      if (window.confirm(message)) {
        await this.submitForm(form, submitter, true)
      }
      return
    }

    if (!response.ok || data.status !== "success") {
      window.alert(data.errors?.join?.("\n") || data.message || "Could not create feature.")
      return
    }

    window.location.href = data.redirect_url || window.location.href
  }

  submitterFor(event) {
    return event.submitter || document.activeElement?.closest?.("button, input[type=\"submit\"]")
  }
}
