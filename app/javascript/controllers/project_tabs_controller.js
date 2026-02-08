import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tabButton", "tabPanel"]

  switchTab(event) {
    event.preventDefault()
    const tabName = event.currentTarget.dataset.tab
    
    // Remove active class from all buttons and panels
    this.tabButtonTargets.forEach(btn => btn.classList.remove('active'))
    this.tabPanelTargets.forEach(panel => panel.classList.remove('active'))
    
    // Add active class to clicked button and corresponding panel
    event.currentTarget.classList.add('active')
    const panel = this.tabPanelTargets.find(p => p.dataset.tabPanel === tabName)
    if (panel) {
      panel.classList.add('active')
      panel.dispatchEvent(new CustomEvent('project-tab-shown', {
        detail: { tab: tabName },
        bubbles: true
      }))
    }
  }
}

