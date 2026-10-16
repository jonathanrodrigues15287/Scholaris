import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_openapi_contract.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from app.main import app


def test_assignment_versioning_and_error_contract_are_exposed_in_openapi():
	schema = app.openapi()
	schemas = schema["components"]["schemas"]

	update_schema = schemas["AssignmentUpdate"]
	assert "version" in update_schema["required"]
	assert update_schema["properties"]["version"]["minimum"] == 1.0

	read_schema = schemas["AssignmentRead"]
	assert read_schema["properties"]["version"]["type"] == "integer"

	error_schema = schemas["ErrorResponse"]
	assert {"code", "message"}.issubset(error_schema["required"])
	assert error_schema["properties"]["details"]["anyOf"][-1] == {"type": "null"}
	assert {"type": "null"} in error_schema["properties"]["request_id"]["anyOf"]
	assert {"type": "string"} in error_schema["properties"]["request_id"]["anyOf"]


def test_assignment_operations_document_auth_idempotency_and_pagination():
	schema = app.openapi()
	patch = schema["paths"]["/api/v1/assignments/{assignment_id}"]["patch"]
	create = schema["paths"]["/api/v1/assignments"]["post"]
	courses = schema["paths"]["/api/v1/courses"]["get"]

	assert patch["security"] == [{"APIKeyCookie": []}, {"HTTPBearer": []}]
	assert create["security"] == [{"APIKeyCookie": []}, {"HTTPBearer": []}]
	idempotency_parameter = next(
		parameter for parameter in create["parameters"] if parameter["name"] == "X-Idempotency-Key"
	)
	assert idempotency_parameter["required"] is True

	parameters = {parameter["name"]: parameter for parameter in courses["parameters"]}
	assert parameters["page"]["schema"]["default"] == 1
	assert parameters["page_size"]["schema"]["default"] == 20
	assert parameters["page_size"]["schema"]["maximum"] == 100
