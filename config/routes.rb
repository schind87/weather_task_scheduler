Rails.application.routes.draw do
  root 'home#index'

  get 'up' => 'rails/health#show', as: :rails_health_check

  resources :tasks, defaults: { format: :json }
  resources :suggestions, only: :create, defaults: { format: :json }
end
