import os

class Settings:
	app_name = os.getenv("APP_NAME", "Scholaris API")
	database_url = os.getenv(
		"DATABASE_URL",
		"postgresql+psycopg2://scholaris:scholaris@localhost:5432/scholaris",
	)
	jwt_secret_key = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
	jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
	access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
	frontend_origin = os.getenv("FRONTEND_ORIGIN", "*")


settings = Settings()
