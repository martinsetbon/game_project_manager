import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tabButton", "tabPanel"]
  static values = { projectId: Number }

  connect() {
    const defaultTab = 'timeline'
    const key = this.storageKey()
    const savedTab = key ? localStorage.getItem(key) : null
    this.activateTab(savedTab || defaultTab)
  }

  switchTab(event) {
    event.preventDefault()
    const tabName = event.currentTarget.dataset.tab
    this.activateTab(tabName)
    const key = this.storageKey()
    if (key) {
      localStorage.setItem(key, tabName)
    }
  }

  activateTab(tabName) {
    if (!tabName) return

    this.tabButtonTargets.forEach(btn => btn.classList.remove('active'))
    this.tabPanelTargets.forEach(panel => panel.classList.remove('active'))

    const button = this.tabButtonTargets.find(b => b.dataset.tab === tabName)
    const panel = this.tabPanelTargets.find(p => p.dataset.tabPanel === tabName)
    if (button) button.classList.add('active')
    if (panel) {
      panel.classList.add('active')
      panel.dispatchEvent(new CustomEvent('project-tab-shown', {
        detail: { tab: tabName },
        bubbles: true
      }))
    }
  }

  storageKey() {
    if (!this.hasProjectIdValue) return null
    return `project_tab_${this.projectIdValue}`
  }
}

