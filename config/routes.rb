Rails.application.routes.draw do
  devise_for :users

  resources :projects do
    member do
      get :timeline
      get :team
    end

    resources :project_features
    resources :project_contributors, only: [:create, :destroy], param: :user_id
  end

  root to: 'projects#index'
end
