from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    duration_hours = Column(Integer)  # Total hours required
    min_temp = Column(Float)
    max_temp = Column(Float)
    no_rain = Column(Integer)  # 1 if rain not allowed, 0 otherwise
    location = Column(String)
    created_at = Column(DateTime)
