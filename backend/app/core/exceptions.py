class DomainError(Exception):
	status_code = 400
	code = "DOMAIN_ERROR"

	def __init__(self, detail: str):
		super().__init__(detail)
		self.detail = detail


class AuthenticationError(DomainError):
	status_code = 401


class NotFoundError(DomainError):
	status_code = 404


class ConflictError(DomainError):
	status_code = 409


class VersionConflictError(ConflictError):
	code = "VERSION_CONFLICT"

	def __init__(self, server: dict, client: dict, updated_at: str | None):
		super().__init__("The assignment was changed on another device")
		self.server = server
		self.client = client
		self.updated_at = updated_at


class RateLimitError(DomainError):
	status_code = 429

	def __init__(self, detail: str, retry_after: int):
		super().__init__(detail)
		self.retry_after = retry_after
