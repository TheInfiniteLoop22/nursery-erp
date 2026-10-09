from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timezone

from app.core.deps import get_db, require_admin
from app.models.product import Product
from app.models.notification import Notification
from app.models.user import UserTable
from app.services.notification_service import mark_notification_as_read
from pydantic import BaseModel
from app.utils.size_formatter import extract_view_dimensions

router = APIRouter()

class LowStockNotification(BaseModel):
    product_id: str
    item_name: str
    size: str
    height_feet: str = "N/A"
    caliper_inches: str = "N/A"
    current_stock: int
    threshold: int
    nursery_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminNotification(BaseModel):
    notification_id: str
    type: str
    title: str
    message: str
    actor_user_id: str | None = None
    reference_id: str | None = None
    is_read: bool
    created_at: datetime

@router.get("/low-stock", response_model=List[LowStockNotification])
def get_low_stock_items(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin)
):
    """
    Get all products with inventory below their low stock threshold (Admin only)
    """
    low_stock_products = db.query(Product).filter(
        Product.inventory_quantity <= Product.low_stock_threshold
    ).order_by(Product.inventory_quantity, Product.product_id).offset(offset).limit(limit).all()
    
    notifications: list[LowStockNotification] = []
    for product in low_stock_products:
        height_feet, caliper_inches = extract_view_dimensions(product.section, product.size)
        notifications.append(
            LowStockNotification(
                product_id=product.product_id,
                item_name=product.item_name,
                size=product.size,
                height_feet=height_feet,
                caliper_inches=caliper_inches,
                current_stock=product.inventory_quantity,
                threshold=product.low_stock_threshold,
                nursery_id=product.nursery_id,
                created_at=datetime.now(timezone.utc),
            )
        )
    
    return notifications


@router.get("")
def get_admin_notifications(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin),
    page: int = 1,
    page_size: int = 20,
    is_read: bool | None = None,
    reference_id: str | None = None,
    types: list[str] = Query(default=[]),
):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    query = db.query(Notification)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if reference_id and reference_id.strip():
        query = query.filter(Notification.reference_id == reference_id.strip())
    if types:
        cleaned_types = [item.strip() for item in types if item and item.strip()]
        if cleaned_types:
            query = query.filter(Notification.type.in_(cleaned_types))

    total = query.with_entities(func.count(Notification.notification_id)).scalar() or 0
    offset = (page - 1) * page_size
    notifications = (
        query
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [
        AdminNotification(
            notification_id=item.notification_id,
            type=item.type,
            title=item.title,
            message=item.message,
            actor_user_id=item.actor_user_id,
            reference_id=item.reference_id,
            is_read=item.is_read,
            created_at=item.created_at,
        )
        for item in notifications
    ]
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": items,
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin),
):
    count = db.query(func.count(Notification.notification_id)).filter(Notification.is_read.is_(False)).scalar() or 0
    return {"unread_count": int(count)}


@router.patch("/{notification_id}/read", response_model=AdminNotification)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin),
):
    notification = mark_notification_as_read(db, notification_id)
    return AdminNotification(
        notification_id=notification.notification_id,
        type=notification.type,
        title=notification.title,
        message=notification.message,
        actor_user_id=notification.actor_user_id,
        reference_id=notification.reference_id,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )
