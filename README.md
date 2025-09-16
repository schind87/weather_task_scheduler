# Weather-Aware Task Scheduler

A FastAPI service to schedule tasks that require certain weather conditions (e.g., no rain, temperature above a threshold).
- Add/view/edit/delete your tasks via `/tasks`
- Get weather-based suggestions via `/suggestions`

## Configuration

The service now requires an [OpenWeather](https://openweathermap.org/api) API key.  Provide the
credential through the `OPENWEATHER_API_KEY` environment variable before starting FastAPI or
running tests. For example:

```bash
export OPENWEATHER_API_KEY="your-openweather-api-key"
uvicorn app.main:app --reload
```

When deploying, configure the runtime environment (e.g., systemd unit, container orchestrator,
or hosting provider dashboard) to inject the same environment variable so the application can
authenticate against OpenWeather during startup.
