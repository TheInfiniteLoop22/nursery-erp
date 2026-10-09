from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order_table import OrderTable, OrderStatus
from app.models.ordered_products import OrderedProducts

VALID_ALL_STATUSES = {OrderStatus.CREATED, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED}
VALID_PAID_STATUSES = {OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED}


def build_orders_list_query(
    db: Session,
    *,
    scannable_only: bool = False,
    search: str | None = None,
    status: str | None = None,
):
    items_sq = (
        db.query(
            OrderedProducts.order_id,
            func.sum(OrderedProducts.quantity).label("items_count"),
        )
        .group_by(OrderedProducts.order_id)
        .subquery()
    )

    query = (
        db.query(OrderTable, items_sq.c.items_count)
        .outerjoin(items_sq, items_sq.c.order_id == OrderTable.order_id)
    )

    if scannable_only:
        query = query.filter(OrderTable.status.in_(list(VALID_PAID_STATUSES)))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (OrderTable.order_id.ilike(term))
            | (OrderTable.client_name.ilike(term))
            | (OrderTable.designer_name.ilike(term))
        )

    if status and status.strip().lower() != "all":
        normalized = status.strip().upper()
        allowed = VALID_PAID_STATUSES if scannable_only else VALID_ALL_STATUSES
        if normalized in {s.value for s in allowed}:
            query = query.filter(OrderTable.status == OrderStatus(normalized))

    return query


def serialize_order_row(order: OrderTable, items_count: int | None) -> dict[str, Any]:
    return {
        "order_id": order.order_id,
        "user_id": order.user_id,
        "client_name": order.client_name,
        "work_order_type": getattr(order, "work_order_type", "INSTALL"),
        "designer_name": getattr(order, "designer_name", None),
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "total_order_amount": str(order.total_order_amount),
        "ordered_at": str(order.ordered_at),
        "updated_at": str(order.updated_at),
        "invoice_generated_at": str(order.invoice_generated_at) if order.invoice_generated_at else None,
        "paid_at": str(order.paid_at) if order.paid_at else None,
        "items_count": int(items_count or 0),
    }


def list_orders_paginated(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
    scannable_only: bool = False,
) -> tuple[list[dict[str, Any]], int]:
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    offset = (page - 1) * page_size

    query = build_orders_list_query(
        db,
        scannable_only=scannable_only,
        search=search,
        status=status,
    )

    total = query.with_entities(func.count(OrderTable.order_id)).scalar() or 0
    rows = (
        query.order_by(OrderTable.ordered_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [serialize_order_row(order, items_count) for order, items_count in rows]
    return items, int(total)


def get_orders_summary(
    db: Session,
    *,
    search: str | None = None,
    scannable_only: bool = False,
) -> dict[str, int]:
    query = build_orders_list_query(
        db,
        scannable_only=scannable_only,
        search=search,
        status=None,
    )

    rows = (
        query.with_entities(OrderTable.status, func.count(OrderTable.order_id))
        .group_by(OrderTable.status)
        .all()
    )

    counts = {
        "total": 0,
        "created": 0,
        "in_progress": 0,
        "completed": 0,
    }

    for order_status, count in rows:
        status_value = order_status.value if hasattr(order_status, "value") else str(order_status)
        count_int = int(count or 0)
        counts["total"] += count_int
        if status_value == OrderStatus.CREATED.value:
            counts["created"] = count_int
        elif status_value == OrderStatus.IN_PROGRESS.value:
            counts["in_progress"] = count_int
        elif status_value == OrderStatus.COMPLETED.value:
            counts["completed"] = count_int

    return counts


def paginated_response(
    items: list[dict[str, Any]],
    *,
    total: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }
