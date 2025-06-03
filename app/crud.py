from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime

def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks(db: Session):
    return db.query(models.Task).all()

def create_task(db: Session, task: schemas.TaskCreate):
    db_task = models.Task(
        name=task.name,
        duration_hours=task.duration_hours,
        min_temp=task.min_temp,
        max_temp=task.max_temp,
        no_rain=int(task.no_rain),
        location=task.location,
        created_at=datetime.utcnow()
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
    for field, value in task_update.dict().items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task
