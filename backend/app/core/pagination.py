"""Pagination params + the standard list envelope.

Envelope (per contract):
    { "data": [...], "pagination": { page, page_size, total, total_pages } }
"""

from dataclasses import dataclass
from math import ceil

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


@dataclass
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


def paginate(db: Session, stmt: Select, params: PageParams) -> tuple[list, dict]:
    """Execute ``stmt`` with limit/offset and return (rows, pagination dict)."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = list(
        db.execute(stmt.limit(params.page_size).offset(params.offset)).scalars().all()
    )
    pagination = {
        "page": params.page,
        "page_size": params.page_size,
        "total": total,
        "total_pages": ceil(total / params.page_size) if params.page_size else 0,
    }
    return rows, pagination


def apply_sort(stmt: Select, model, sort: str | None, default_col: str = "created_at") -> Select:
    """Apply a ``col:dir,col2:dir`` sort spec, falling back to ``default_col`` desc."""
    if not sort:
        col = getattr(model, default_col, None)
        return stmt.order_by(col.desc()) if col is not None else stmt
    for token in sort.split(","):
        token = token.strip()
        if not token:
            continue
        name, _, direction = token.partition(":")
        col = getattr(model, name.strip(), None)
        if col is None:
            continue
        stmt = stmt.order_by(col.desc() if direction.strip().lower() == "desc" else col.asc())
    return stmt
