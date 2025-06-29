require "test_helper"

class ProjectFeatureTest < ActiveSupport::TestCase
  def setup
    @user = User.create!(
      email: "test@example.com", 
      password: "password123", 
      name: "Test User",
      job: "Developer"
    )
    @project = Project.create!(
      name: "Test Project", 
      description: "A test project",
      start_date: Date.today,
      user: @user
    )
    @project_contributor = ProjectContributor.create!(project: @project, user: @user)
  end

  test "should prevent overlapping features for same responsible contributor" do
    # Create first feature
    feature1 = @project.project_features.create!(
      name: "Feature 1",
      duration: 5,
      department: "Programming",
      start_date: Date.today
    )
    feature1.feature_assignments.create!(user: @user, role: "responsible")
    
    # Create second feature that would overlap
    feature2 = @project.project_features.create!(
      name: "Feature 2", 
      duration: 3,
      department: "Programming",
      start_date: Date.today + 2.days  # This would overlap with feature1
    )
    feature2.feature_assignments.create!(user: @user, role: "responsible")
    
    # Reload features to get updated dates
    feature1.reload
    feature2.reload
    
    # Verify that feature2 was adjusted to start after feature1 ends
    assert_equal feature1.end_date + 1.day, feature2.start_date
    assert_equal feature2.start_date + 3.days, feature2.end_date
  end

  test "should not affect features with different responsible contributors" do
    @user2 = User.create!(
      email: "test2@example.com", 
      password: "password123", 
      name: "Test User 2",
      job: "Designer"
    )
    @project_contributor2 = ProjectContributor.create!(project: @project, user: @user2)
    
    # Create first feature with user1
    feature1 = @project.project_features.create!(
      name: "Feature 1",
      duration: 5,
      department: "Programming", 
      start_date: Date.today
    )
    feature1.feature_assignments.create!(user: @user, role: "responsible")
    
    # Create second feature with user2 that overlaps
    feature2 = @project.project_features.create!(
      name: "Feature 2",
      duration: 3,
      department: "Programming",
      start_date: Date.today + 2.days  # This overlaps with feature1
    )
    feature2.feature_assignments.create!(user: @user2, role: "responsible")
    
    # Reload features
    feature1.reload
    feature2.reload
    
    # Verify that feature2 was NOT adjusted since it has a different responsible contributor
    assert_equal Date.today + 2.days, feature2.start_date
  end

  test "should handle multiple features for same contributor" do
    # Create multiple features that would overlap
    feature1 = @project.project_features.create!(
      name: "Feature 1",
      duration: 3,
      department: "Programming",
      start_date: Date.today
    )
    feature1.feature_assignments.create!(user: @user, role: "responsible")
    
    feature2 = @project.project_features.create!(
      name: "Feature 2",
      duration: 2,
      department: "Programming", 
      start_date: Date.today + 1.day  # Overlaps with feature1
    )
    feature2.feature_assignments.create!(user: @user, role: "responsible")
    
    feature3 = @project.project_features.create!(
      name: "Feature 3",
      duration: 4,
      department: "Programming",
      start_date: Date.today + 2.days  # Overlaps with both
    )
    feature3.feature_assignments.create!(user: @user, role: "responsible")
    
    # Reload all features
    feature1.reload
    feature2.reload
    feature3.reload
    
    # Verify they are now sequential without overlaps
    assert_equal Date.today, feature1.start_date
    assert_equal Date.today + 3.days, feature1.end_date
    
    assert_equal Date.today + 4.days, feature2.start_date
    assert_equal Date.today + 5.days, feature2.end_date
    
    assert_equal Date.today + 6.days, feature3.start_date
    assert_equal Date.today + 9.days, feature3.end_date
  end
end
