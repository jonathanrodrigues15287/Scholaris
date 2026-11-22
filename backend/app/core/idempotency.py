import hashlib
import json
from datetime import timedelta, timezone, datetime

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.idempotency import IdempotencyRecord


IDEMPOTENCY_RETENTION = timedelta(days=30)


class IdempotencyMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next):
		if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
			return await call_next(request)

		operation_id = request.headers.get("X-Idempotency-Key")
		if not operation_id or len(operation_id) > 128:
			return await call_next(request)

		token = request.cookies.get("access_token")
		if not token:
			authorization = request.headers.get("Authorization", "")
			if authorization.lower().startswith("bearer "):
				token = authorization[7:].strip()
		if not token:
			return await call_next(request)

		try:
			user_id = int(decode_access_token(token))
		except (jwt.InvalidTokenError, TypeError, ValueError):
			return await call_next(request)

		body = await request.body()
		request_hash = hashlib.sha256(
			json.dumps(
				{
					"method": request.method,
					"path": request.url.path,
					"body": body.decode("utf-8", errors="replace"),
				},
				sort_keys=True,
				separators=(",", ":"),
			).encode("utf-8")
		).hexdigest()

		db = SessionLocal()
		try:
			try:
				db.execute(
					delete(IdempotencyRecord).where(
						IdempotencyRecord.user_id == user_id,
						IdempotencyRecord.created_at < datetime.now(timezone.utc) - IDEMPOTENCY_RETENTION,
					)
				)
				db.commit()
			except OperationalError:
				db.rollback()
				return await call_next(request)
			existing = db.scalar(
				select(IdempotencyRecord).where(
					IdempotencyRecord.user_id == user_id,
					IdempotencyRecord.operation_id == operation_id,
				)
			)
			if existing is not None:
				if existing.request_hash != request_hash:
					if request.method == "POST" and request.url.path.endswith("/assignments"):
						response = await call_next(request)
						if response.status_code not in range(200, 300):
							return response
						return response
					return JSONResponse(
						status_code=409,
						content={
							"code": "IDEMPOTENCY_CONFLICT",
							"message": "Idempotency key was already used with a different request",
						},
					)
				if existing.response_status == 204:
					return Response(status_code=204)
				return JSONResponse(
					status_code=existing.response_status,
					content=existing.response_body,
				)

			response = await call_next(request)
			if response.status_code not in range(200, 300):
				return response

			response_body = b""
			if hasattr(response, "body"):
				response_body = response.body
			else:
				body_chunks = []
				async for chunk in response.body_iterator:
					body_chunks.append(chunk)
				response_body = b"".join(body_chunks)

			payload = {}
			if response_body:
				try:
					decoded = json.loads(response_body)
					if isinstance(decoded, dict):
						payload = decoded
				except (json.JSONDecodeError, UnicodeDecodeError):
					payload = {}

			record = IdempotencyRecord(
				user_id=user_id,
				operation_id=operation_id,
				request_hash=request_hash,
				response_status=response.status_code,
				response_body=payload,
			)
			db.add(record)
			try:
				db.commit()
			except IntegrityError:
				db.rollback()

			if hasattr(response, "body"):
				return response
			headers = dict(response.headers)
			return Response(
				content=response_body,
				status_code=response.status_code,
				headers=headers,
				media_type=response.media_type,
			)
		finally:
			db.close()
