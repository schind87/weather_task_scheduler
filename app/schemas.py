from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TaskBase(BaseModel):
    name: str
    duration_hours: int
    min_temp: float
    max_temp: Optional[float] = None
    no_rain: bool = True
    location: str

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class SuggestionRequest(BaseModel):
    task_id: int

class SuggestionResponse(BaseModel):
    possible_windows: list
