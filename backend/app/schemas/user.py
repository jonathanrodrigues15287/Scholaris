import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class UserCreate(BaseModel):
	email: EmailStr
	name: str | None = Field(default=None, min_length=1, max_length=120)
	full_name: str | None = Field(default=None, min_length=1, max_length=120)
	password: str = Field(min_length=12, max_length=128)

	@field_validator("password")
	@classmethod
	def validate_password_strength(cls, value: str) -> str:
		if not re.search(r"[A-Z]", value) or not re.search(r"[a-z]", value):
			raise ValueError("Password must include upper- and lowercase letters")
		if not re.search(r"\d", value) or not re.search(r"[^A-Za-z0-9]", value):
			raise ValueError("Password must include a number and a symbol")
		return value

	@model_validator(mode="after")
	def require_name(self):
		if not self.name and not self.full_name:
			raise ValueError("name is required")
		return self


class UserRead(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: int
	email: EmailStr
	name: str
	minimum_attendance_threshold: float


class AuthSession(BaseModel):
	authenticated: bool = True
	user: UserRead

