# Weather-Aware Task Scheduler (Ruby on Rails)

A Ruby on Rails application for planning tasks that depend on weather conditions. Create tasks with temperature, humidity, and rain constraints, then fetch weather-aware windows that satisfy those requirements.

## Prerequisites

- Ruby 3.2.3
- Bundler (`gem install bundler` if not already available)
- SQLite (included with Ruby installation)
- An [OpenWeather](https://openweathermap.org/api) API key exposed as `OPENWEATHER_API_KEY`

## Getting started

```bash
bundle install
bin/rails db:prepare
export OPENWEATHER_API_KEY="your-openweather-api-key"
bin/rails server
```

Visit [http://localhost:3000](http://localhost:3000) to open the single-page interface. All task CRUD and suggestion requests are performed via JSON endpoints:

- `GET /tasks` – list saved tasks
- `POST /tasks` – create a task (returns scheduling suggestions)
- `PUT /tasks/:id` – update a task and recompute suggestions
- `DELETE /tasks/:id` – delete a task
- `POST /suggestions` – fetch fresh scheduling windows for a task (`{ "task_id": 1 }`)

## Running tests

```
bin/rails test
```

The test suite covers the scheduling window calculations and the JSON APIs.

## Deployment notes

Ensure the deployment environment also provides the `OPENWEATHER_API_KEY` credential so the weather client can reach OpenWeather successfully. The application uses SQLite by default; update `config/database.yml` if a different database is required in production.
