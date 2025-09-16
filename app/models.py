from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    duration_hours = Column(Integer)  # Total hours required
    min_temp = Column(Float, nullable=True)
    max_temp = Column(Float, nullable=True)
    min_humidity = Column(Integer, nullable=True)
    max_humidity = Column(Integer, nullable=True)
    no_rain = Column(Boolean, default=True)  # True if rain not allowed
    location = Column(String)
    created_at = Column(DateTime)
    scheduled_time = Column(DateTime, nullable=True)
    earliest_start = Column(String, nullable=True)
    latest_start = Column(String, nullable=True)
