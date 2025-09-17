# Weather-Aware Task Scheduler

A FastAPI service to schedule tasks that require certain weather conditions (e.g., no rain, temperature above a threshold).
- Add/view/edit/delete your tasks via `/tasks`
- Get weather-based suggestions via `/suggestions`

## Database initialization

The SQLite database file is not tracked in source control. Create or refresh the schema before running the app by executing:

```bash
python scripts/init_db.py
```

The script (and the FastAPI application itself) uses the SQLAlchemy models to build `test.db` with all required columns so new environments provision the database automatically.
