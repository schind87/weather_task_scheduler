# Weather-Aware Task Scheduler

A FastAPI service to schedule tasks that require certain weather conditions (e.g., no rain, temperature above a threshold).
- Add/view/edit/delete your tasks via `/tasks`
- Get weather-based suggestions via `/suggestions`

## Environment variables

Set the `OPENWEATHER_API_KEY` environment variable with your
[OpenWeather](https://openweathermap.org/api) credential before starting the
application or running tests.

```bash
export OPENWEATHER_API_KEY="your-openweather-api-key"
uvicorn app.main:app --reload
```

### Deployment

Ensure the deployment environment (systemd unit, container orchestrator, managed
hosting, etc.) also provides `OPENWEATHER_API_KEY` so the service can authenticate
against OpenWeather during startup.

