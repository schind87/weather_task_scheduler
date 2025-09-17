from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime
from . import weather, find_windows
from fastapi import HTTPException

def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks(db: Session):
    return db.query(models.Task).all()

def create_task(db: Session, task: schemas.TaskCreate):
    # Fetch forecast and find scheduling window
    try:
        forecast, timezone_offset = weather.fetch_hourly_forecast(task.location)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    window_result = find_windows.find_windows(
        forecast=forecast,
        min_temp=task.min_temp,
        max_temp=task.max_temp,
        min_humidity=getattr(task, 'min_humidity', None),
        max_humidity=getattr(task, 'max_humidity', None),
        no_rain=bool(task.no_rain),
        duration_hours=task.duration_hours,
        earliest_start=getattr(task, 'earliest_start', None),
        latest_start=getattr(task, 'latest_start', None),
        timezone_offset=timezone_offset,
    )
    windows = window_result['windows']
    scheduled_time = None
    if windows:
        # Use the start_ts of the first available window
        scheduled_time = datetime.utcfromtimestamp(windows[0]["start_ts"])
    db_task = models.Task(
        name=task.name,
        duration_hours=task.duration_hours,
        min_temp=task.min_temp,
        max_temp=task.max_temp,
        min_humidity=getattr(task, 'min_humidity', None),
        max_humidity=getattr(task, 'max_humidity', None),
        no_rain=bool(task.no_rain),
        location=task.location,
        created_at=datetime.utcnow(),
        scheduled_time=scheduled_time,
        earliest_start=getattr(task, 'earliest_start', None),
        latest_start=getattr(task, 'latest_start', None)
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
        return True
    return False

def update_task(db: Session, task_id: int, task_update: schemas.TaskCreate):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return None
    update_data = task_update.dict()
    update_data.pop('scheduled_time', None)
    for field, value in update_data.items():
        setattr(task, field, value)
    try:
        forecast, timezone_offset = weather.fetch_hourly_forecast(task.location)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    window_result = find_windows.find_windows(
        forecast=forecast,
        min_temp=task.min_temp,
        max_temp=task.max_temp,
        min_humidity=task.min_humidity,
        max_humidity=task.max_humidity,
        no_rain=bool(task.no_rain),
        duration_hours=task.duration_hours,
        earliest_start=task.earliest_start,
        latest_start=task.latest_start,
        timezone_offset=timezone_offset,
    )
    windows = window_result['windows']
    task.scheduled_time = datetime.utcfromtimestamp(windows[0]['start_ts']) if windows else None
    db.commit()
    db.refresh(task)
    return task
