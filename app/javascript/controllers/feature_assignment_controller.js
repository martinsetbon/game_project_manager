// app/javascript/controllers/feature_assignment_controller.js
import { Controller } from "@hotwired/stimulus"
import { Modal } from "bootstrap"

export default class extends Controller {
  static targets = ["responsibleSelect", "accountableSelect", "submitButton", "modal"]
  modal = null

  connect() {
    this.modal = new Modal(this.modalTarget)
  }

  checkDuplicate(event) {
    event.preventDefault()
    const responsibleVal = this.responsibleSelectTarget.value
    const accountableVal = this.accountableSelectTarget.value

    if (responsibleVal && accountableVal && responsibleVal === accountableVal) {
      this.modal.show()
      this.submitButtonTarget.disabled = true
      return false
    }
    this.submitButtonTarget.disabled = false
    return true
  }

  confirmDuplicate() {
    this.modal.hide()
    this.submitButtonTarget.disabled = false
    this.element.submit()
  }
}
