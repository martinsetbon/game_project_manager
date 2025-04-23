require "application_system_test_case"

class ProjectFeaturesTest < ApplicationSystemTestCase
  setup do
    @project_feature = project_features(:one)
  end

  test "visiting the index" do
    visit project_features_url
    assert_selector "h1", text: "Project features"
  end

  test "should create project feature" do
    visit project_features_url
    click_on "New project feature"

    fill_in "Duration", with: @project_feature.duration
    fill_in "Name", with: @project_feature.name
    fill_in "Project", with: @project_feature.project_id
    click_on "Create Project feature"

    assert_text "Project feature was successfully created"
    click_on "Back"
  end

  test "should update Project feature" do
    visit project_feature_url(@project_feature)
    click_on "Edit this project feature", match: :first

    fill_in "Duration", with: @project_feature.duration
    fill_in "Name", with: @project_feature.name
    fill_in "Project", with: @project_feature.project_id
    click_on "Update Project feature"

    assert_text "Project feature was successfully updated"
    click_on "Back"
  end

  test "should destroy Project feature" do
    visit project_feature_url(@project_feature)
    click_on "Destroy this project feature", match: :first

    assert_text "Project feature was successfully destroyed"
  end
end
