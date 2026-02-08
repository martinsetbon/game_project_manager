Rails.application.routes.draw do
  devise_for :users

  # Dashboard routes
  get 'dashboard', to: 'dashboard#index'
  get 'dashboard/counts', to: 'dashboard#counts', as: 'dashboard_counts'
  
  # Move task to backlog - explicit POST route
  post 'dashboard/move_task_to_backlog', to: 'dashboard#move_task_to_backlog', as: 'dashboard_move_task_to_backlog'
  
  # Dynamic tab route - must come after specific routes
  get 'dashboard/tab/:tab', to: 'dashboard#tab_content', as: 'dashboard_tab'
  
  # Profile routes
  get 'profile', to: 'profiles#show'
  patch 'profile', to: 'profiles#update'
  patch 'profile/update_field', to: 'profiles#update_field'
  
  # Notifications routes
  resources :notifications, only: [:index] do
    member do
      patch :mark_as_viewed
    end
  end
  
  # Users routes
  get 'users', to: 'users#index'
  
  # Backlog routes
  get 'backlog', to: 'backlog#index'
  
  # Feature Templates routes
  resources :feature_templates, only: [:index, :create, :destroy] do
    member do
      post :apply_to_feature
    end
  end
  
  resources :projects do
    member do
      get :team
      get :timeline_data
      post :extend_stand_by_features
    end

    resources :project_features do
      member do
        patch :update_status
        patch :update_dates
        patch :change_status
      end
      resources :feature_segments, only: [:create, :update, :destroy]
      resources :feature_checkpoints, only: [:create, :destroy]
      resources :tasks, only: [:index, :create, :update, :destroy] do
        collection do
          post :update_template
        end
      end
    end

    resources :tasks, only: [:new, :create, :show, :update, :destroy], controller: 'project_tasks'

    resources :project_contributors, only: [:create, :destroy]
  end

  root to: 'dashboard#index'
end
