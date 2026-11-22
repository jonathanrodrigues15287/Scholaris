import hashlib
import json
import asyncio

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError, OperationalError

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.idempotency import IdempotencyRecord


def _is_idempotency_unique_violation(error: IntegrityError) -> bool:
	original = error.orig
	constraint_name = getattr(getattr(original, "diag", None), "constraint_name", None)
	if constraint_name == "uq_idempotency_user_operation":
		return True
	message = str(original).lower()
	return (
		"uq_idempotency_user_operation" in message
		or "unique constraint failed: idempotency_records.user_id, idempotency_records.operation_id" in message
	)


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
					insert(IdempotencyRecord).values(
						user_id=user_id,
						operation_id=operation_id,
						request_hash=request_hash,
						state="pending",
						response_status=None,
						response_body=None,
					)
				)
				db.commit()
			except OperationalError:
				db.rollback()
				return await call_next(request)
			except IntegrityError as reservation_error:
				db.rollback()
				if not _is_idempotency_unique_violation(reservation_error):
					raise
				existing = db.scalar(
					select(IdempotencyRecord).where(
						IdempotencyRecord.user_id == user_id,
						IdempotencyRecord.operation_id == operation_id,
					)
				)
				if existing is None:
					await asyncio.sleep(0.05)
					existing = db.scalar(
						select(IdempotencyRecord).where(
							IdempotencyRecord.user_id == user_id,
							IdempotencyRecord.operation_id == operation_id,
						)
					)
				if existing is None:
					return JSONResponse(
						status_code=425,
						content={
							"code": "IDEMPOTENCY_IN_PROGRESS",
							"message": "The idempotency reservation was released before completion",
						},
					)
				if existing.request_hash != request_hash:
					return JSONResponse(
						status_code=409,
						content={
							"code": "IDEMPOTENCY_CONFLICT",
							"message": "Idempotency key was already used with a different request",
						},
					)

				for _ in range(100):
					db.expire_all()
					current = db.scalar(
						select(IdempotencyRecord).where(
							IdempotencyRecord.user_id == user_id,
							IdempotencyRecord.operation_id == operation_id,
						)
					)
					if current is not None and current.state == "completed":
						if current.request_hash != request_hash:
							break
						if current.response_status == 204:
							return Response(status_code=204)
						return JSONResponse(
							status_code=current.response_status or 500,
							content=current.response_body or {},
						)
					await asyncio.sleep(0.05)

				return JSONResponse(
					status_code=425,
					content={
						"code": "IDEMPOTENCY_IN_PROGRESS",
						"message": "The same idempotency operation is still in progress",
					},
				)

			try:
				response = await call_next(request)
			except Exception:
				db.execute(
					delete(IdempotencyRecord)
					.where(
						IdempotencyRecord.user_id == user_id,
						IdempotencyRecord.operation_id == operation_id,
					)
				)
				db.commit()
				raise

			if response.status_code not in range(200, 300):
				db.execute(
					delete(IdempotencyRecord)
					.where(
						IdempotencyRecord.user_id == user_id,
						IdempotencyRecord.operation_id == operation_id,
					)
				)
				db.commit()
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

			db.execute(
				update(IdempotencyRecord)
				.where(
					IdempotencyRecord.user_id == user_id,
					IdempotencyRecord.operation_id == operation_id,
				)
				.values(
					state="completed",
					response_status=response.status_code,
					response_body=payload if response.status_code != 204 else None,
				)
			)
			db.commit()

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
