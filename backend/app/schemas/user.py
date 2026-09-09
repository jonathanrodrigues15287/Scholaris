from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class UserCreate(BaseModel):
	email: EmailStr
	name: str | None = Field(default=None, min_length=1, max_length=120)
	full_name: str | None = Field(default=None, min_length=1, max_length=120)
	password: str = Field(min_length=8, max_length=128)

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


class Token(BaseModel):
	access_token: str
	token_type: str = "bearer"
