from sqlalchemy import create_engine, inspect

from app.core.config import settings


engine = create_engine(settings.DATABASE_URL)
table_names = set(inspect(engine).get_table_names())
application_tables = table_names - {"alembic_version"}
if application_tables:
	raise SystemExit(
		f"Database is not clean; application tables found: {sorted(application_tables)}"
	)
print("Database is clean.")
