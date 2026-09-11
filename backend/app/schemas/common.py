from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, Field


ItemT = TypeVar("ItemT")


class ErrorBody(BaseModel):
	code: str
	message: str
	details: list[dict[str, object]] = Field(default_factory=list)


class ErrorResponse(BaseModel):
	detail: str
	error: ErrorBody


class Page(BaseModel, Generic[ItemT]):
	items: list[ItemT]
	total: int = Field(ge=0)
	page: int = Field(ge=1)
	page_size: int = Field(ge=1)
	pages: int = Field(ge=0)


def make_page(items: list[ItemT], total: int, page: int, page_size: int) -> Page[ItemT]:
	return Page(
		items=items,
		total=total,
		page=page,
		page_size=page_size,
		pages=ceil(total / page_size) if total else 0,
	)
