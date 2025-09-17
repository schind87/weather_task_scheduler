from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict


class TaskBase(BaseModel):
    name: str
    duration_hours: int
    min_temp: Optional[float] = None
    max_temp: Optional[float] = None
    min_humidity: Optional[int] = None
    max_humidity: Optional[int] = None
    no_rain: bool = True
    location: str
    scheduled_time: Optional[datetime] = None
    earliest_start: Optional[str] = None  # format HH:MM
    latest_start: Optional[str] = None    # format HH:MM


class TaskCreate(TaskBase):
    @field_validator('location')
    @classmethod
    def validate_zip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('ZIP code is required.')
        base = cleaned.split(',', 1)[0].strip()
        digits = ''.join(ch for ch in base if ch.isdigit())
        if len(digits) not in (5, 9):
            raise ValueError('ZIP code must include 5 or 9 digits.')
        return cleaned


class Task(TaskBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SuggestionRequest(BaseModel):
    task_id: int


class WindowResult(BaseModel):
    display: str
    start_ts: int
    duration: str


class ReasonDetail(BaseModel):
    reason: str
    count: int


class WindowSummary(BaseModel):
    possible_windows: List[WindowResult]
    reason_summary: Optional[str] = None
    reason_details: List[ReasonDetail] = Field(default_factory=list)


class SuggestionResponse(WindowSummary):
    pass


class TaskMutationResponse(WindowSummary):
    task: Task
