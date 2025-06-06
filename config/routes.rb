Rails.application.routes.draw do
  devise_for :users

  resources :projects do
    member do
      get :timeline
      get :team
    end

    resources :project_features do
      member do
        patch :update_status
        patch :update_dates
      end
    end

    resources :project_contributors, only: [:create, :destroy]
  end

  root to: 'projects#index'
end
