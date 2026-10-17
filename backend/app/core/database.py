from contextvars import ContextVar, Token
from collections.abc import Generator
from dataclasses import dataclass
from time import perf_counter

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


@dataclass
class QueryMetrics:
	query_count: int = 0
	db_time: float = 0.0


_active_query_metrics: ContextVar[QueryMetrics | None] = ContextVar(
	"active_query_metrics",
	default=None,
)


def begin_query_metrics() -> Token[QueryMetrics | None]:
	return _active_query_metrics.set(QueryMetrics())


def end_query_metrics(token: Token[QueryMetrics | None]) -> QueryMetrics:
	metrics = _active_query_metrics.get()
	_active_query_metrics.reset(token)
	if metrics is None:
		raise RuntimeError("No active query metrics scope")
	return metrics


class Base(DeclarativeBase):
	pass


engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@event.listens_for(engine, "before_cursor_execute")
def _start_query_timer(
	conn,
	cursor,
	statement,
	parameters,
	context,
	executemany,
):
	if _active_query_metrics.get() is not None:
		context._scholaris_query_started_at = perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _record_query_metrics(
	conn,
	cursor,
	statement,
	parameters,
	context,
	executemany,
):
	metrics = _active_query_metrics.get()
	started_at = getattr(context, "_scholaris_query_started_at", None)
	if metrics is not None and started_at is not None:
		metrics.query_count += 1
		metrics.db_time += perf_counter() - started_at


def get_db() -> Generator[Session, None, None]:
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
