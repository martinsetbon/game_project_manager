// app/javascript/controllers/feature_assignment_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["responsibleSelect", "accountableSelect", "popupButton"]

  connect() {
    console.log("Stimulus controller connected")
  }

  checkDuplicate(event) {
    const responsibleVal = this.responsibleSelectTarget.value
    const accountableVal = this.accountableSelectTarget.value

    if (responsibleVal && accountableVal && responsibleVal === accountableVal) {
      // Trigger the modal popup
      this.popupButtonTarget.click()
    }
  }
}
