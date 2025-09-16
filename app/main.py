from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from . import models, schemas, crud, weather, find_windows
import os
from typing import List

DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

models.Base.metadata.create_all(bind=engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/tasks/", response_model=schemas.TaskMutationResponse)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, task)

@app.get("/tasks/", response_model=List[schemas.Task])
def read_tasks(db: Session = Depends(get_db)):
    return crud.get_tasks(db)

@app.get("/tasks/{task_id}", response_model=schemas.Task)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/tasks/{task_id}", response_model=schemas.TaskMutationResponse)
def update_task(task_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    updated = crud.update_task(db, task_id, task)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}

@app.post("/suggestions/", response_model=schemas.SuggestionResponse)
def get_suggestions(request: schemas.SuggestionRequest, db: Session = Depends(get_db)):
    task = crud.get_task(db, request.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    forecast = weather.fetch_hourly_forecast(task.location)
    window_result = find_windows.find_windows(
        forecast=forecast,
        min_temp=task.min_temp,
        max_temp=task.max_temp,
        min_humidity=getattr(task, 'min_humidity', None),
        max_humidity=getattr(task, 'max_humidity', None),
        no_rain=bool(task.no_rain),
        duration_hours=task.duration_hours,
        earliest_start=getattr(task, 'earliest_start', None),
        latest_start=getattr(task, 'latest_start', None)
    )
    return {
        "possible_windows": window_result["windows"],
        "reason_summary": window_result.get("reason_summary"),
        "reason_details": window_result.get("reason_details", []),
    }
