# frozen_string_literal: true

namespace :feature_templates do
  desc "Create default Character / Level / UI templates for every user (skips if name already exists)"
  task seed_defaults: :environment do
    load Rails.root.join("db/seeds/feature_templates_defaults.rb")
    FeatureTemplatesDefaults.ensure_all!
    puts "Default feature templates ensured for #{User.count} user(s)."
  end
end
