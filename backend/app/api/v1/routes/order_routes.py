from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, get_current_user
from app.schemas.order_schema import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderAddProductRequest,
    OrderRemoveProductRequest,
    OrderProductActionResponse,
    OrderDetailResponse,
    OrderedProductView,
    OrderUpdateRequest,
)

from app.services.order_service import (
    create_order_service,
    add_product_to_order_service,
    remove_product_from_order_service,
    update_order_basic_details_service,
)
from app.services.order_list_service import (
    get_orders_summary,
    list_orders_paginated,
    paginated_response,
)
from app.schemas.order_schema import OrderListSummaryResponse, PaginatedOrderListResponse

from app.models.user import UserTable
from app.models.order_table import OrderTable, OrderStatus
from app.models.ordered_products import OrderedProducts
from app.services.notification_service import create_notification

router = APIRouter()


def _require_order_manager(user: UserTable):
    if user.role not in ("admin", "nursery"):
        raise HTTPException(status_code=403, detail="Only admin or nursery can edit orders")
    return user

# Get approved orders (for employees/nursery scanners)
@router.get("/paid", response_model=PaginatedOrderListResponse)
def get_paid_orders(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
):
    """
    Endpoint for employees/nursery to fetch approved scannable orders.
    Returns orders with status IN_PROGRESS or COMPLETED.
    """
    if current_user.role not in ("employee", "nursery", "admin", "head_installation", "head_maintenance"):
        raise HTTPException(status_code=403, detail="Access denied")

    page = max(1, page)
    page_size = min(100, max(1, page_size))

    if current_user.role in ("head_installation", "head_maintenance"):
        target_type = "INSTALL" if current_user.role == "head_installation" else "MAINTENANCE"
        from app.services.order_list_service import build_orders_list_query, serialize_order_row
        from sqlalchemy import func

        query = build_orders_list_query(
            db,
            scannable_only=False,
            search=search,
            status=status,
        )
        query = query.filter(OrderTable.work_order_type == target_type)

        offset = (page - 1) * page_size
        total = query.with_entities(func.count(OrderTable.order_id)).scalar() or 0
        rows = (
            query.order_by(OrderTable.ordered_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )
        items = [serialize_order_row(order, items_count) for order, items_count in rows]
        return paginated_response(items, total=total, page=page, page_size=page_size)

    items, total = list_orders_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        scannable_only=True,
    )
    return paginated_response(items, total=total, page=page, page_size=page_size)

@router.get("/summary", response_model=OrderListSummaryResponse)
def get_orders_list_summary(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    search: str | None = None,
    scannable_only: bool = False,
):
    if scannable_only:
        if current_user.role not in (
            "employee",
            "nursery",
            "admin",
            "head_installation",
            "head_maintenance",
        ):
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

    if current_user.role in ("head_installation", "head_maintenance"):
        from app.services.order_list_service import build_orders_list_query
        from sqlalchemy import func
        target_type = "INSTALL" if current_user.role == "head_installation" else "MAINTENANCE"
        query = build_orders_list_query(db, scannable_only=False, search=search)
        query = query.filter(OrderTable.work_order_type == target_type)
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

    return get_orders_summary(db, search=search, scannable_only=scannable_only)


# Get all orders
@router.get("/all", response_model=PaginatedOrderListResponse)
def get_all_orders(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
):
    page = max(1, page)
    page_size = min(100, max(1, page_size))

    items, total = list_orders_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        scannable_only=False,
    )
    return paginated_response(items, total=total, page=page, page_size=page_size)


# Create Order
@router.post("/create", response_model=OrderCreateResponse)
def create_order(
    payload: OrderCreateRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    order = create_order_service(db, payload)
    return OrderCreateResponse(
        order_id=order.order_id,
        status=order.status,
        message="Order created "
    )


# Add/Update product into order
@router.post("/{order_id}/add-product", response_model=OrderProductActionResponse)
def add_product(
    order_id: str,
    payload: OrderAddProductRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    _require_order_manager(current_user)
    existing_line = db.query(OrderedProducts).filter(
        OrderedProducts.order_id == order_id,
        OrderedProducts.product_id == payload.product_id
    ).first()
    old_qty = int(existing_line.quantity) if existing_line else 0
    line, order_total = add_product_to_order_service(db, order_id, payload)

    # Avoid noisy activity logs for no-op updates (e.g., 5 -> 5).
    if old_qty != int(line.quantity):
        action = "updated" if old_qty > 0 else "added"
        create_notification(
            db,
            type="order_edit",
            title="Order item updated",
            message=(
                f"{current_user.user_username} ({current_user.role}) {action} "
                f"product {payload.product_id} in order {order_id}: {old_qty} -> {line.quantity}"
            ),
            actor_user_id=current_user.user_id,
            reference_id=order_id,
        )
    db.commit()

    return OrderProductActionResponse(
        order_id=order_id,
        product_id=line.product_id,
        quantity=line.quantity,
        line_total=str(line.total_price),
        order_total=str(order_total),
        message="Product added/updated "
    )


# Remove/Decrease product from order
@router.post("/{order_id}/remove-product")
def remove_product(
    order_id: str,
    payload: OrderRemoveProductRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    _require_order_manager(current_user)
    existing_line = db.query(OrderedProducts).filter(
        OrderedProducts.order_id == order_id,
        OrderedProducts.product_id == payload.product_id
    ).first()
    old_qty = int(existing_line.quantity) if existing_line else 0
    order_total = remove_product_from_order_service(db, order_id, payload)

    removed_qty = old_qty if payload.quantity is None else min(old_qty, int(payload.quantity))
    new_qty = max(0, old_qty - removed_qty)
    if old_qty != new_qty:
        create_notification(
            db,
            type="order_edit",
            title="Order item removed/updated",
            message=(
                f"{current_user.user_username} ({current_user.role}) updated "
                f"product {payload.product_id} in order {order_id}: {old_qty} -> {new_qty}"
            ),
            actor_user_id=current_user.user_id,
            reference_id=order_id,
        )
    db.commit()

    return {
        "order_id": order_id,
        "product_id": payload.product_id,
        "order_total": str(order_total),
        "message": "Product removed/updated"
    }


# Get full order + products
@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_details(
    order_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == "head_installation" and getattr(order, "work_order_type", "INSTALL") != "INSTALL":
        raise HTTPException(status_code=403, detail="Access denied: Installation head can only view installation orders")
    if current_user.role == "head_maintenance" and getattr(order, "work_order_type", "INSTALL") != "MAINTENANCE":
        raise HTTPException(status_code=403, detail="Access denied: Maintenance head can only view maintenance orders")
    
    # Employees and nursery can only access approved orders (heads can view created, in_progress, and completed).
    if current_user.role not in ("admin", "head_installation", "head_maintenance") and order.status == OrderStatus.CREATED:
        raise HTTPException(status_code=403, detail="Access denied: Order not approved yet")

    lines = db.query(OrderedProducts).filter(OrderedProducts.order_id == order_id).all()

    items = [
        OrderedProductView(
            product_id=l.product_id,
            quantity=l.quantity,
            unit_price=str(l.unit_price),
            rate_percentage=str(l.rate_percentage) if l.rate_percentage is not None else None,
            total_price=str(l.total_price)
        )
        for l in lines
    ]

    return OrderDetailResponse(
        order_id=order.order_id,
        user_id=order.user_id,
        client_name=order.client_name,
        work_order_type=getattr(order, "work_order_type", "INSTALL"),
        designer_name=getattr(order, "designer_name", None),
        status=order.status,
        total_order_amount=str(order.total_order_amount),
        ordered_at=str(order.ordered_at),
        updated_at=str(order.updated_at),
        invoice_generated_at=str(order.invoice_generated_at) if order.invoice_generated_at else None,
        paid_at=str(order.paid_at) if order.paid_at else None,
        items=items
    )

@router.patch("/{order_id}/update")
def update_order_details(
    order_id: str,
    payload: OrderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    _require_order_manager(current_user)
    current_order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    old_client_name = current_order.client_name if current_order else ""
    old_designer = getattr(current_order, "designer_name", None) if current_order else None
    order = update_order_basic_details_service(
        db=db,
        order_id=order_id,
        client_name=payload.client_name,
        designer_name=payload.designer_name,
    )

    changed = False
    if old_client_name != order.client_name:
        changed = True
        create_notification(
            db,
            type="order_edit",
            title="Order details updated",
            message=(
                f"{current_user.user_username} ({current_user.role}) changed "
                f"order {order_id} client name: '{old_client_name}' -> '{order.client_name}'"
            ),
            actor_user_id=current_user.user_id,
            reference_id=order_id,
        )
    new_designer = getattr(order, "designer_name", None)
    if old_designer != new_designer:
        changed = True
        create_notification(
            db,
            type="order_edit",
            title="Order details updated",
            message=(
                f"{current_user.user_username} ({current_user.role}) changed "
                f"order {order_id} designer: '{old_designer}' -> '{new_designer}'"
            ),
            actor_user_id=current_user.user_id,
            reference_id=order_id,
        )
    if changed:
        db.commit()

    return {
        "message": "Order updated ",
        "order_id": order.order_id,
        "client_name": order.client_name,
        "work_order_type": getattr(order, "work_order_type", "INSTALL"),
        "designer_name": getattr(order, "designer_name", None),
        "status": order.status,
        "updated_at": str(order.updated_at)
    }

@router.post("/{order_id}/generate-invoice")
def generate_invoice(
    order_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    from datetime import datetime
    
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.invoice_generated_at:
        raise HTTPException(status_code=400, detail="Invoice already generated for this order")
    
    # Update invoice_generated_at and updated_at timestamps
    order.invoice_generated_at = datetime.now()
    order.updated_at = datetime.now()
    db.commit()
    db.refresh(order)
    
    return {
        "message": "Invoice generated successfully",
        "order_id": order.order_id,
        "invoice_generated_at": str(order.invoice_generated_at),
        "updated_at": str(order.updated_at)
    }

@router.post("/{order_id}/mark-paid")
def mark_order_paid(
    order_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    from datetime import datetime
    
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order.invoice_generated_at:
        raise HTTPException(status_code=400, detail="Invoice must be generated before marking as paid")
    
    if order.paid_at:
        raise HTTPException(status_code=400, detail="Order already marked as paid")
    
    # Update paid_at, status, and updated_at timestamps
    order.paid_at = datetime.now()
    order.status = OrderStatus.IN_PROGRESS
    order.updated_at = datetime.now()
    db.commit()
    db.refresh(order)
    
    return {
        "message": "Order marked as paid successfully",
        "order_id": order.order_id,
        "work_order_type": getattr(order, "work_order_type", "INSTALL"),
        "paid_at": str(order.paid_at),
        "status": order.status,
        "updated_at": str(order.updated_at)
    }