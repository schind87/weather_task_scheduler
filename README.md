# Weather-Aware Task Scheduler (Rails)

This Ruby on Rails application provides a JSON API for creating and managing tasks
that depend on weather conditions such as temperature, humidity, and rainfall. It
replaces the previous FastAPI implementation with a Rails 7 stack while keeping
the same feature set:

- Create, update, list, and delete tasks via `/tasks`.
- Fetch weather-aware scheduling windows while mutating tasks.
- Request new scheduling suggestions for an existing task via `/suggestions`.

## Requirements

- Ruby 3.2+
- Bundler
- SQLite (default development/test database)
- An [OpenWeather](https://openweathermap.org/api) API key

## Setup

```bash
bundle install
bin/rails db:setup
```

Before starting the server or running tests, export your OpenWeather credential:

```bash
export OPENWEATHER_API_KEY="your-openweather-api-key"
```

## Running the application

```bash
bin/rails server
```

The HTML landing page at `/` highlights the JSON endpoints. Interact with the API
using a tool such as `curl`, `HTTPie`, or Postman.

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/tasks` | `GET` | List all tasks |
| `/tasks` | `POST` | Create a task and receive suggested windows |
| `/tasks/:id` | `GET` | Retrieve a single task |
| `/tasks/:id` | `PUT` | Update a task and refresh scheduling windows |
| `/tasks/:id` | `DELETE` | Remove a task |
| `/suggestions` | `POST` | Get fresh suggestions for an existing task |

## Tests

```bash
bin/rails test
```

## Configuration

The application reads `OPENWEATHER_API_KEY` at runtime. If the credential is
missing, requests that require weather data respond with an explanatory error.
