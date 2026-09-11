from sqlalchemy import func, select
from sqlalchemy.orm import Session


def fetch_page(query, db: Session, page: int, page_size: int):
	count_query = select(func.count()).select_from(query.order_by(None).subquery())
	total = db.scalar(count_query) or 0
	items = list(db.scalars(query.offset((page - 1) * page_size).limit(page_size)))
	return items, total
