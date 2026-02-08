# Cron Job Setup for Stand-by Feature Extension

## Current Cron Job
```
0 2 * * * cd /Ubuntu/root/code/daddymsgh/game_project_manager && /usr/bin/rails daily:all RAILS_ENV=development
```

## Issues and Solutions

### 1. Environment Issues
The cron job might not have access to the same environment as your user session.

### 2. Path Issues
The cron job might not find the correct paths.

### 3. Database Connection
The cron job might not be able to connect to the database.

## Improved Cron Job
Replace your current cron job with this more robust version:

```bash
0 2 * * * cd /Ubuntu/root/code/daddymsgh/game_project_manager && /usr/bin/rails daily:all RAILS_ENV=development >> /Ubuntu/root/code/daddymsgh/game_project_manager/log/cron.log 2>&1
```

## Manual Testing
To test the stand-by extension manually, run:

```bash
cd /Ubuntu/root/code/daddymsgh/game_project_manager
bundle exec rails features:extend_stand_by
```

## Debugging
Check the log files:
- `/Ubuntu/root/code/daddymsgh/game_project_manager/log/stand_by_extension.log`
- `/Ubuntu/root/code/daddymsgh/game_project_manager/log/cron.log`

## Alternative: Use whenever gem
Consider using the `whenever` gem for better cron job management in Rails:

1. Add to Gemfile: `gem 'whenever', require: false`
2. Run: `bundle install`
3. Run: `bundle exec wheneverize .`
4. Edit `config/schedule.rb`
5. Run: `bundle exec whenever --update-crontab`
