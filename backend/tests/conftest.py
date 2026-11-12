import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "ci-only-secret-key-with-at-least-32-characters")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "false")
