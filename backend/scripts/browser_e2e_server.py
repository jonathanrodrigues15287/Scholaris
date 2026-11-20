from pathlib import Path
import sys

import uvicorn

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import Base, engine
import app.models


database = Path("browser_e2e.db")
if database.exists():
    database.unlink()

engine.dispose()
Base.metadata.create_all(bind=engine)
uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
