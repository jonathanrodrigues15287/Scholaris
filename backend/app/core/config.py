from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	model_config = SettingsConfigDict(
		env_file=(".env", ".env.local"),
		env_file_encoding="utf-8",
		extra="ignore",
	)

	APP_NAME: str = "Scholaris API"
	APP_VERSION: str = "1.0.0"
	APP_ENV: str = "development"
	DEBUG: bool = False

	DATABASE_URL: str

	JWT_SECRET_KEY: SecretStr
	JWT_ALGORITHM: str = "HS256"
	ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
	REFRESH_TOKEN_EXPIRE_DAYS: int = 14
	COOKIE_SECURE: bool | None = None
	COOKIE_DOMAIN: str | None = None

	CORS_ORIGINS: list[str] = ["http://localhost:5500"]

	@model_validator(mode="after")
	def validate_security_settings(self):
		if len(self.JWT_SECRET_KEY.get_secret_value()) < 32:
			raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
		if self.APP_ENV == "production":
			if self.DEBUG:
				raise ValueError("DEBUG must be false in production")
			if "*" in self.CORS_ORIGINS:
				raise ValueError("Wildcard CORS origins are not allowed in production")
		return self

	@property
	def secure_cookies(self) -> bool:
		return self.COOKIE_SECURE if self.COOKIE_SECURE is not None else self.APP_ENV == "production"

settings = Settings()
