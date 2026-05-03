# frozen_string_literal: true

require "test_helper"

class ProjectFeatureBulkCreatorTest < ActiveSupport::TestCase
  setup do
    @owner = User.create!(
      email: "owner@example.com",
      password: "password123",
      name: "Owner",
      job: "Producer"
    )
    @responsible = User.create!(
      email: "responsible@example.com",
      password: "password123",
      name: "Responsible",
      job: "Developer"
    )
    @project = Project.create!(
      name: "Game",
      description: "Test project",
      user: @owner
    )
    ProjectContributor.create!(project: @project, user: @responsible)
  end

  test "schedules unassigned tasks from the first task start date" do
    start_date = Date.new(2026, 5, 4)
    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: @owner,
      feature_name: "Combat",
      task_rows: [
        { "name" => "Design", "start_date" => start_date.to_s },
        { "name" => "Prototype" },
        { "name" => "Polish", "start_date" => (start_date + 10.days).to_s },
        { "name" => "Review" }
      ]
    )

    result = creator.create!
    tasks = result[:tasks]

    assert_equal :success, result[:status]
    assert_equal [start_date, start_date + 1.day, start_date + 10.days, start_date + 11.days], tasks.map(&:start_date)
    assert_equal tasks.map(&:start_date), tasks.map(&:end_date)
    assert tasks.none?(&:in_backlog?)
    assert_equal start_date, result[:feature].start_date
    assert_equal start_date + 11.days, result[:feature].end_date
  end

  test "requires assigned tasks to have their own start date" do
    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: @owner,
      feature_name: "Combat",
      task_rows: [
        { "name" => "Design", "start_date" => Date.new(2026, 5, 4).to_s },
        { "name" => "Build", "responsible_user_id" => @responsible.id.to_s }
      ]
    )

    result = creator.create!

    assert_equal :error, result[:status]
    assert_includes result[:errors], 'Task "Build" must have a start date when it is assigned to a responsible user.'
    assert_equal 0, @project.project_features.where(name: "Combat").count
  end

  test "detects overlaps on the unassigned row" do
    existing_feature = @project.project_features.create!(
      name: "Existing",
      start_date: Date.new(2026, 5, 4),
      end_date: Date.new(2026, 5, 4)
    )
    Task.create!(
      project: @project,
      project_feature: existing_feature,
      name: "Existing task",
      status: "not_started",
      start_date: Date.new(2026, 5, 4),
      end_date: Date.new(2026, 5, 4),
      duration: 1
    )

    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: @owner,
      feature_name: "Combat",
      task_rows: [
        { "name" => "Design", "start_date" => Date.new(2026, 5, 4).to_s }
      ]
    )

    assert creator.overlap_messages.any? { |message| message.include?("the unassigned row") }
  end

  test "creates feature tasks from template and anchor date" do
    template = @owner.feature_templates.create!(
      name: "Combat template",
      tasks_data: [
        { "name" => "Design", "duration" => 2 },
        { "name" => "Build", "duration" => 3 }
      ]
    )
    anchor_date = Date.new(2026, 5, 4)

    creator = ProjectFeatureBulkCreator.new(
      project: @project,
      creator: @owner,
      feature_name: "Combat",
      template: template,
      anchor_date: anchor_date,
      from_template_only: true
    )

    result = creator.create!
    tasks = result[:tasks]

    assert_equal :success, result[:status]
    assert_equal ["Design", "Build"], tasks.map(&:name)
    assert_equal [anchor_date, anchor_date + 2.days], tasks.map(&:start_date)
    assert_equal [anchor_date + 1.day, anchor_date + 4.days], tasks.map(&:end_date)
  end
end
