from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import uuid

from app.core.deps import get_db, get_current_user
from app.models.user import UserTable
from app.models.employee_scan_log import EmployeeScanLog
from app.models.product import Product
from app.models.order_table import OrderTable
from app.models.ordered_products import OrderedProducts
from app.services.notification_service import create_notification
from app.services.event_bus import bus
from app.utils.size_formatter import section_uses_gallon_pot_sizing

router = APIRouter()


class ScanRequest(BaseModel):
    order_id: str
    product_id: str
    quantity_scanned: int = 1


@router.post("/scan")
def record_scan(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    """
    Record a barcode scan for an employee working on an order.
    Reduces the product's inventory_quantity by the scanned amount.
    """
    if payload.quantity_scanned <= 0:
        raise HTTPException(status_code=400, detail="quantity_scanned must be positive")

    # Validate order exists and is in a scannable state
    order = db.query(OrderTable).filter(OrderTable.order_id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "head_installation" and getattr(order, "work_order_type", "INSTALL") != "INSTALL":
        raise HTTPException(status_code=403, detail="Access denied: Installation head can only scan installation orders")
    if current_user.role == "head_maintenance" and getattr(order, "work_order_type", "INSTALL") != "MAINTENANCE":
        raise HTTPException(status_code=403, detail="Access denied: Maintenance head can only scan maintenance orders")

    if order.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Order is already completed")

    # Validate product exists in the order
    order_item = db.query(OrderedProducts).filter(
        OrderedProducts.order_id == payload.order_id,
        OrderedProducts.product_id == payload.product_id,
    ).with_for_update().first()  # lock the line: concurrent scans of one line are serialised
    if not order_item:
        raise HTTPException(
            status_code=404,
            detail="Product not found in this order"
        )

    # Fetch product
    # Lock order: order line first, then product, always, so two scans can't deadlock.
    product = db.query(Product).filter(Product.product_id == payload.product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    allows_bulk_quantity_scan = section_uses_gallon_pot_sizing(product.section)
    if payload.quantity_scanned > 1 and not allows_bulk_quantity_scan:
        raise HTTPException(
            status_code=400,
            detail="Bulk scan quantity is allowed only for shrubs and perennials (gallon pot) products"
        )

    already_scanned = db.query(func.coalesce(func.sum(EmployeeScanLog.scanned_quantity), 0)).filter(
        EmployeeScanLog.order_id == payload.order_id,
        EmployeeScanLog.product_id == payload.product_id,
    ).scalar() or 0

    remaining_order_quantity = max(0, order_item.quantity - int(already_scanned))
    if remaining_order_quantity <= 0:
        raise HTTPException(status_code=400, detail="This product is already fully scanned for the order")

    if product.inventory_quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"No inventory left for this product. Need {remaining_order_quantity} more in stock to continue."
        )

    effective_scanned_quantity = min(
        int(payload.quantity_scanned),
        remaining_order_quantity,
        int(product.inventory_quantity),
    )
    if effective_scanned_quantity <= 0:
        raise HTTPException(status_code=400, detail="Unable to record scan quantity")

    # Deduct only what can be applied to this order and available inventory.
    product.inventory_quantity = max(0, product.inventory_quantity - effective_scanned_quantity)

    # Create scan log
    scan_log = EmployeeScanLog(
        scan_id=f"scn_{uuid.uuid4().hex[:12]}",
        employee_id=current_user.user_id,
        order_id=payload.order_id,
        product_id=payload.product_id,
        scanned_quantity=effective_scanned_quantity,
    )
    db.add(scan_log)
    create_notification(
        db,
        type="order_scan",
        title="Order item scanned",
        message=(
            f"{current_user.user_username} ({current_user.role}) scanned "
            f"{effective_scanned_quantity} of {payload.product_id} for order {payload.order_id}"
        ),
        actor_user_id=current_user.user_id,
        reference_id=payload.order_id,
    )
    db.commit()
    db.refresh(product)

    remaining_after_scan = max(0, remaining_order_quantity - effective_scanned_quantity)
    bus.publish(
        "scan",
        {
            "order_id": payload.order_id,
            "product_id": product.product_id,
            "quantity_scanned": effective_scanned_quantity,
            "new_inventory_quantity": product.inventory_quantity,
            "remaining_order_quantity": remaining_after_scan,
            "by": current_user.user_username,
            "by_user_id": current_user.user_id,
        },
    )
    shortage_to_stock = max(0, remaining_after_scan - int(product.inventory_quantity))

    return {
        "scan_id": scan_log.scan_id,
        "product_id": product.product_id,
        "requested_quantity": int(payload.quantity_scanned),
        "quantity_scanned": effective_scanned_quantity,
        "new_inventory_quantity": product.inventory_quantity,
        "remaining_order_quantity": remaining_after_scan,
        "shortage_to_stock": shortage_to_stock,
        "message": (
            "Scan recorded successfully"
            if shortage_to_stock == 0 else
            f"Scan recorded. Need {shortage_to_stock} more in stock to finish this line."
        ),
    }


@router.get("/scans")
def get_scan_logs_for_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    """
    Return all scan logs for a given order, aggregated per product.
    Used to restore scanned_quantity when loading the order page.
    """
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "head_installation" and getattr(order, "work_order_type", "INSTALL") != "INSTALL":
        raise HTTPException(status_code=403, detail="Access denied: Installation head can only access scan logs of installation orders")
    if current_user.role == "head_maintenance" and getattr(order, "work_order_type", "INSTALL") != "MAINTENANCE":
        raise HTTPException(status_code=403, detail="Access denied: Maintenance head can only access scan logs of maintenance orders")

    logs = (
        db.query(EmployeeScanLog)
        .filter(EmployeeScanLog.order_id == order_id)
        .all()
    )

    # Aggregate per product
    totals: dict[str, int] = {}
    for log in logs:
        totals[log.product_id] = totals.get(log.product_id, 0) + log.scanned_quantity

    return {"order_id": order_id, "scanned_quantities": totals}
