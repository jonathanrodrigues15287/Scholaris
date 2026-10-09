import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_scholaris.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from sqlalchemy import text

from app.core.database import SessionLocal, begin_query_metrics, end_query_metrics


def test_query_metrics_count_and_time_sql_execution():
	session = SessionLocal()
	token = begin_query_metrics()
	try:
		session.execute(text("SELECT 1"))
	finally:
		metrics = end_query_metrics(token)
		session.close()

	assert metrics.query_count == 1
	assert metrics.db_time >= 0
