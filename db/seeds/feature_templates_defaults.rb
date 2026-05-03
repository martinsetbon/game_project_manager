# frozen_string_literal: true

# Idempotent default feature templates (task pipelines) for each user.
# Load with: load Rails.root.join("db/seeds/feature_templates_defaults.rb")
# Then: FeatureTemplatesDefaults.ensure_all!

module FeatureTemplatesDefaults
  TEMPLATES = [
    {
      name: "Character — hero pipeline",
      tasks_data: [
        { "name" => "Art direction & concept / turnaround", "duration" => 5 },
        { "name" => "High-poly sculpt & primary forms", "duration" => 8 },
        { "name" => "Retopology & game-resolution mesh", "duration" => 6 },
        { "name" => "UVs & texel budget", "duration" => 4 },
        { "name" => "PBR texturing (skin, cloth, metal)", "duration" => 7 },
        { "name" => "Rigging & skin weights", "duration" => 5 },
        { "name" => "Locomotion (idle, walk, run, sprint)", "duration" => 5 },
        { "name" => "Combat animations (attacks, hit reactions)", "duration" => 6 },
        { "name" => "Dodge / evade / hit-stun polish", "duration" => 4 },
        { "name" => "Facial blend shapes & expressions", "duration" => 4 },
        { "name" => "Engine integration & QA pass", "duration" => 5 }
      ]
    },
    {
      name: "Level / environment — playable zone",
      tasks_data: [
        { "name" => "Design brief & metrics (metrics, pacing)", "duration" => 3 },
        { "name" => "Greybox / blockout for gameplay", "duration" => 8 },
        { "name" => "Playtest iteration on layout", "duration" => 5 },
        { "name" => "Modular kit & trim modeling", "duration" => 8 },
        { "name" => "Hero props & unique set pieces", "duration" => 7 },
        { "name" => "Materials, trim sheets & decals", "duration" => 5 },
        { "name" => "UVs & lightmap / streaming setup", "duration" => 4 },
        { "name" => "Set dressing & storytelling reads", "duration" => 6 },
        { "name" => "Lighting (baked + dynamic probes)", "duration" => 6 },
        { "name" => "Atmosphere, fog & post stack", "duration" => 4 },
        { "name" => "LOD, culling & performance pass", "duration" => 5 },
        { "name" => "Final polish & bugfix", "duration" => 4 }
      ]
    },
    {
      name: "UI — screens & HUD",
      tasks_data: [
        { "name" => "UX flow & information architecture", "duration" => 4 },
        { "name" => "Wireframes (menus, HUD, popups)", "duration" => 5 },
        { "name" => "Visual style & UI kit (colors, type)", "duration" => 5 },
        { "name" => "HUD layout & combat feedback", "duration" => 5 },
        { "name" => "Inventory / map / settings screens", "duration" => 6 },
        { "name" => "Icons, buttons & controller prompts", "duration" => 4 },
        { "name" => "Motion spec (transitions, focus)", "duration" => 3 },
        { "name" => "Implementation with engineering", "duration" => 6 },
        { "name" => "Localization & string overflow pass", "duration" => 4 },
        { "name" => "Accessibility & final QA", "duration" => 4 }
      ]
    }
  ].freeze

  def self.ensure_for_user!(user)
    TEMPLATES.each do |spec|
      next if user.feature_templates.exists?(name: spec[:name])

      user.feature_templates.create!(name: spec[:name], tasks_data: spec[:tasks_data].deep_dup)
    end
  end

  def self.ensure_all!
    User.find_each { |u| ensure_for_user!(u) }
  end
end
