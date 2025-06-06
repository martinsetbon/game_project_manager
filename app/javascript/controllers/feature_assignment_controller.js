// app/javascript/controllers/feature_assignment_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["responsibleSelect", "accountableSelect", "popupButton"]

  connect() {
    console.log("Stimulus controller connected")
  }

  checkDuplicate() {
    const responsibleId = this.responsibleSelectTarget.value
    const accountableId = this.accountableSelectTarget.value

    if (responsibleId && accountableId && responsibleId === accountableId) {
      this.popupButtonTarget.click()
    }
  }

  handleSubmission(event) {
    // Handle any post-submission logic if needed
  }
}
