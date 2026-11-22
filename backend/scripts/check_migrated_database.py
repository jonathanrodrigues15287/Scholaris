from sqlalchemy import create_engine, inspect

from app.core.config import settings


required_tables = {
	"alembic_version",
	"users",
	"courses",
	"assignments",
	"attendance",
	"idempotency_records",
}
engine = create_engine(settings.DATABASE_URL)
table_names = set(inspect(engine).get_table_names())
missing = required_tables - table_names
if missing:
	raise SystemExit(f"Migration is missing required tables: {sorted(missing)}")
print("Migrated database schema contains required tables.")
