"""Add usernames as a login credential.

Revision ID: 0012_add_usernames
Revises: 0011_drop_redundant_user_id
Create Date: 2026-09-12
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_add_usernames"
down_revision = "0011_drop_redundant_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column("users", sa.Column("username", sa.String(length=80), nullable=True))
	op.execute(
		"""
		WITH ranked_users AS (
			SELECT
				id,
				left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '_', 'g'), 70) AS base_name,
				row_number() OVER (
					PARTITION BY lower(split_part(email, '@', 1))
					ORDER BY id
				) AS occurrence
			FROM users
		)
		UPDATE users AS target
		SET username = CASE
			WHEN ranked_users.occurrence = 1 THEN ranked_users.base_name
			ELSE ranked_users.base_name || '-' || ranked_users.occurrence
		END
		FROM ranked_users
		WHERE target.id = ranked_users.id AND target.username IS NULL
		"""
	)
	op.alter_column("users", "username", nullable=False)
	op.create_unique_constraint("uq_users_username", "users", ["username"])
	op.create_index("ix_users_username", "users", ["username"], unique=False)


def downgrade() -> None:
	op.drop_index("ix_users_username", table_name="users")
	op.drop_constraint("uq_users_username", "users", type_="unique")
	op.drop_column("users", "username")
