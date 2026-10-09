from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, get_current_user
from app.models.user import UserTable
from app.services.notification_service import create_notification
from app.services.event_bus import bus
from app.services.order_status_service import start_order_service, complete_order_service

router = APIRouter()

# CREATED -> IN_PROGRESS
@router.patch("/{order_id}/start")
def start_order(
    order_id: str,
    db: Session = Depends(get_db),
    admin: UserTable = Depends(require_admin)
):
    order = start_order_service(db, order_id, admin.user_id)
    create_notification(
        db,
        type="order_approved",
        title="Order approved",
        message=f"{admin.user_username} approved order {order.order_id}. It is now ready for scanning.",
        actor_user_id=admin.user_id,
        reference_id=order.order_id,
    )
    db.commit()
    bus.publish("order_status", {"order_id": order.order_id, "status": order.status, "by": admin.user_username})
    return {
        "message": "Order moved to IN_PROGRESS ✅",
        "order_id": order.order_id,
        "status": order.status,
        "updated_at": str(order.updated_at)
    }


# IN_PROGRESS -> COMPLETED (accessible by any authenticated user, including employees)
@router.patch("/{order_id}/complete")
def complete_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    from fastapi import HTTPException
    from app.models.order_table import OrderTable
    order_check = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order_check:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "head_installation" and getattr(order_check, "work_order_type", "INSTALL") != "INSTALL":
        raise HTTPException(status_code=403, detail="Access denied: Installation head can only complete installation orders")
    if current_user.role == "head_maintenance" and getattr(order_check, "work_order_type", "INSTALL") != "MAINTENANCE":
        raise HTTPException(status_code=403, detail="Access denied: Maintenance head can only complete maintenance orders")

    order = complete_order_service(db, order_id, current_user.user_id)

    if current_user.role in ("employee", "nursery", "head_installation", "head_maintenance"):
        create_notification(
            db,
            type="order_completed",
            title=f"Order Completed By {current_user.role.replace('_', ' ').title()}",
            message=(
                f"{current_user.user_username} marked order {order.order_id} as COMPLETED"
            ),
            actor_user_id=current_user.user_id,
            reference_id=order.order_id,
        )
        db.commit()

    bus.publish("order_status", {"order_id": order.order_id, "status": order.status, "by": current_user.user_username})
    return {
        "message": "Order moved to COMPLETED ✅",
        "order_id": order.order_id,
        "status": order.status,
        "updated_at": str(order.updated_at),
        "paid_at": str(order.paid_at)
    }
