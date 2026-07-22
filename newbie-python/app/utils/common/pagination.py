import math
from typing import Generic, TypeVar, Optional

from fastapi import Query
from pydantic import BaseModel, Field


T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    item_page: int = Field(default=10, ge=1, le=100)
    order_by: str = Field(default="user_name")
    order_dir: str = Field(default="asc")
    search_key: Optional[str] = Field(default=None)

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.item_page

class ConversationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    item_page: int = Field(default=10, ge=1, le=100)

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.item_page


class PaginatedResponse(BaseModel, Generic[T]):
    docs: list[T]
    total: int
    page: int
    item_page: int
    total_page: int


def get_pagination_params(
    page: int = Query(default=1, ge=1),
    item_page: int = Query(default=10, ge=1, le=100),
    order_by: str = Query(default="user_name"),
    order_dir: str = Query(default="asc"),
    search_key: Optional[str] = Query(default=None)
) -> PaginationParams:
    return PaginationParams(
        page=page,
        item_page=item_page,
        order_by=order_by,
        order_dir=order_dir,
        search_key=search_key,
    )

def get_conversation_params(
    page: int = Query(default=1, ge=1),
    item_page: int = Query(default=10, ge=1, le=100),
) -> ConversationParams:
    return ConversationParams(
        page=page,
        item_page=item_page,
    )


def calculate_total_page(total: int, item_page: int) -> int:
    if total <= 0:
        return 0

    return math.ceil(total / item_page)


def build_paginated_response(
    *,
    docs: list[T],
    total: int,
    pagination: PaginationParams | ConversationParams,
) -> PaginatedResponse[T]:
    return PaginatedResponse[T](
        docs=docs,
        total=total,
        page=pagination.page,
        item_page=pagination.item_page,
        total_page=calculate_total_page(
            total=total,
            item_page=pagination.item_page,
        ),
    )