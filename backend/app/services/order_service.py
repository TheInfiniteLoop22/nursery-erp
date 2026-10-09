from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from uuid import uuid4
from decimal import Decimal

from app.models.order_table import OrderTable
from app.models.ordered_products import OrderedProducts
from app.models.product import Product
from app.models.user import UserTable
from app.models.employee_scan_log import EmployeeScanLog

from app.schemas.order_schema import (
    OrderCreateRequest,
    OrderAddProductRequest,
    OrderRemoveProductRequest,
)

from app.utils.order_calc import calculate_line_total
from app.core.id_generator import generate_order_id


EDITABLE_STATUSES = {"CREATED", "IN_PROGRESS"}


def _refresh_order_total(db: Session, order_id: str) -> Decimal:
    total = db.query(func.coalesce(func.sum(OrderedProducts.total_price), 0)) \
              .filter(OrderedProducts.order_id == order_id) \
              .scalar()

    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    order.total_order_amount = total
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    return total


def _sum_scanned_for_line(db: Session, order_id: str, product_id: str) -> int:
    scanned = db.query(func.coalesce(func.sum(EmployeeScanLog.scanned_quantity), 0)).filter(
        EmployeeScanLog.order_id == order_id,
        EmployeeScanLog.product_id == product_id,
    ).scalar() or 0
    return int(scanned)


def _rollback_scan_logs(
    db: Session,
    order_id: str,
    product_id: str,
    quantity_to_rollback: int,
) -> int:
    if quantity_to_rollback <= 0:
        return 0

    remaining = int(quantity_to_rollback)
    logs = db.query(EmployeeScanLog).filter(
        EmployeeScanLog.order_id == order_id,
        EmployeeScanLog.product_id == product_id,
    ).order_by(EmployeeScanLog.scanned_at.desc()).all()

    for log in logs:
        if remaining <= 0:
            break
        if log.scanned_quantity <= remaining:
            remaining -= int(log.scanned_quantity)
            db.delete(log)
        else:
            log.scanned_quantity = int(log.scanned_quantity) - remaining
            remaining = 0

    return int(quantity_to_rollback) - remaining


def create_order_service(db: Session, payload: OrderCreateRequest) -> OrderTable:
    user = db.query(UserTable).filter(UserTable.user_id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_order_id = generate_order_id(db)
    
    new_order = OrderTable(
        order_id=new_order_id,
        user_id=payload.user_id,
        client_name=payload.client_name.strip(),
        work_order_type=payload.work_order_type,
        designer_name=payload.designer_name,
        total_order_amount=0,
        status="CREATED"  
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


def add_product_to_order_service(db: Session, order_id: str, payload: OrderAddProductRequest):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot modify order in status={order.status}")

    product = db.query(Product).filter(Product.product_id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    line = db.query(OrderedProducts).filter(
        OrderedProducts.order_id == order_id,
        OrderedProducts.product_id == payload.product_id
    ).first()

    old_qty = line.quantity if line else 0
    new_qty = payload.quantity

    delta = new_qty - old_qty

    line_total = calculate_line_total(
        quantity=new_qty,
        unit_price=Decimal(payload.unit_price),
        rate_percentage=Decimal(payload.rate_percentage) if payload.rate_percentage is not None else None
    )

    if line:
        line.quantity = new_qty
        line.unit_price = payload.unit_price
        line.rate_percentage = payload.rate_percentage
        line.total_price = line_total
    else:
        line = OrderedProducts(
            order_id=order_id,
            product_id=payload.product_id,
            quantity=new_qty,
            unit_price=payload.unit_price,
            rate_percentage=payload.rate_percentage,
            total_price=line_total
        )
        db.add(line)

    # update reserved stock; allow creating shortfall lists instead of hard-failing when stock is low
    product.ordered_quantity += delta

    if product.ordered_quantity < 0:
        raise HTTPException(status_code=500, detail="Stock reservation became negative")

    already_scanned = _sum_scanned_for_line(db, order_id, payload.product_id)
    if already_scanned > new_qty:
        # If line quantity is reduced below already scanned quantity, restore inventory
        # and trim scan logs to keep scanned <= ordered.
        excess_scanned = already_scanned - new_qty
        rolled_back = _rollback_scan_logs(db, order_id, payload.product_id, excess_scanned)
        product.inventory_quantity += int(rolled_back)

    db.commit()

    order_total = _refresh_order_total(db, order_id)
    return line, order_total


# Remove/decrement product from order + rollback ordered_quantity
def remove_product_from_order_service(db: Session, order_id: str, payload: OrderRemoveProductRequest):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot modify order in status={order.status}")

    line = db.query(OrderedProducts).filter(
        OrderedProducts.order_id == order_id,
        OrderedProducts.product_id == payload.product_id
    ).first()

    if not line:
        raise HTTPException(status_code=404, detail="Product not found in this order")

    product = db.query(Product).filter(Product.product_id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    old_qty = line.quantity

    # remove whole line
    if payload.quantity is None or payload.quantity >= old_qty:
        removed_qty = old_qty
        new_qty = 0
        db.delete(line)

    # decrement quantity
    else:
        removed_qty = payload.quantity
        new_qty = old_qty - removed_qty
        line.quantity = new_qty

        line.total_price = calculate_line_total(
            quantity=line.quantity,
            unit_price=Decimal(line.unit_price),
            rate_percentage=Decimal(line.rate_percentage) if line.rate_percentage is not None else None
        )

    # rollback reserved stock
    product.ordered_quantity -= removed_qty

    if product.ordered_quantity < 0:
        raise HTTPException(status_code=500, detail="Stock reservation became negative")

    already_scanned = _sum_scanned_for_line(db, order_id, payload.product_id)
    if already_scanned > new_qty:
        excess_scanned = already_scanned - new_qty
        rolled_back = _rollback_scan_logs(db, order_id, payload.product_id, excess_scanned)
        product.inventory_quantity += int(rolled_back)

    db.commit()

    order_total = _refresh_order_total(db, order_id)
    return order_total

def update_order_basic_details_service(
    db: Session,
    order_id: str,
    *,
    client_name: str | None = None,
    work_order_type: str | None = None,
    designer_name: str | None = None,
):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in EDITABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Order can be updated only when status is CREATED or IN_PROGRESS")
    if client_name is not None:
        order.client_name = client_name.strip()
    if work_order_type is not None:
        order.work_order_type = work_order_type
    if designer_name is not None:
        order.designer_name = designer_name

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order