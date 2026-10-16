from datetime import datetime, timezone

import app.models
from sqlalchemy import DateTime

from app.core.database import Base
from app.models.assignment import Assignment
from app.models.user import User


def test_all_model_timestamp_columns_are_timezone_aware():
	timestamp_columns = [
		column
		for table in Base.metadata.tables.values()
		for column in table.columns
		if isinstance(column.type, DateTime)
	]

	assert timestamp_columns
	assert all(column.type.timezone for column in timestamp_columns)


def test_client_generated_created_at_values_are_utc_aware():
	for model in (Assignment, User):
		generated = model.__table__.c.created_at.default.arg(None)
		assert isinstance(generated, datetime)
		assert generated.tzinfo is timezone.utc
