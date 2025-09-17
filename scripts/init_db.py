"""Initialize the SQLite database for the Weather Task Scheduler application."""
from pathlib import Path
import sys

from sqlalchemy import create_engine

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.models import Base

DATABASE_URL = "sqlite:///./test.db"


def init_db() -> None:
    """Create the SQLite database and ensure all tables exist."""
    # Ensure the parent directory exists before creating the SQLite file
    db_path = Path("test.db")
    if not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized at {db_path.resolve()}")


if __name__ == "__main__":
    init_db()
