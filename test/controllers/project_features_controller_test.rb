require "test_helper"

class ProjectFeaturesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @project_feature = project_features(:one)
  end

  test "should get index" do
    get project_features_url
    assert_response :success
  end

  test "should get new" do
    get new_project_feature_url
    assert_response :success
  end

  test "should create project_feature" do
    assert_difference("ProjectFeature.count") do
      post project_features_url, params: { project_feature: { duration: @project_feature.duration, name: @project_feature.name, project_id: @project_feature.project_id } }
    end

    assert_redirected_to project_feature_url(ProjectFeature.last)
  end

  test "should show project_feature" do
    get project_feature_url(@project_feature)
    assert_response :success
  end

  test "should get edit" do
    get edit_project_feature_url(@project_feature)
    assert_response :success
  end

  test "should update project_feature" do
    patch project_feature_url(@project_feature), params: { project_feature: { duration: @project_feature.duration, name: @project_feature.name, project_id: @project_feature.project_id } }
    assert_redirected_to project_feature_url(@project_feature)
  end

  test "should destroy project_feature" do
    assert_difference("ProjectFeature.count", -1) do
      delete project_feature_url(@project_feature)
    end

    assert_redirected_to project_features_url
  end
end
