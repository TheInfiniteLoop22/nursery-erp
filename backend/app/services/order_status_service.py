from fastapi import HTTPException
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.order_table import OrderTable


def _ensure_planning_job_for_order(db: Session, order: OrderTable, current_user_id: str | None = None):
    from app.models.planning import PlanningJob
    from app.services.planning_service import create_planning_job_service
    from app.schemas.planning_schema import PlanningJobCreate
    from app.models.user import UserTable

    # Check if the user ID exists, otherwise use None to avoid ForeignKeyViolation
    if current_user_id:
        user_exists = db.query(UserTable.user_id).filter(UserTable.user_id == current_user_id).first()
        if not user_exists:
            current_user_id = None

    job_date_str = order.updated_at.strftime("%Y-%m-%d")
    existing_plan = db.query(PlanningJob).filter(
        PlanningJob.work_order_id == order.order_id,
        PlanningJob.job_date == job_date_str,
    ).first()
    if existing_plan:
        return existing_plan

    plan_type = order.work_order_type
    if plan_type not in ("INSTALL", "MAINTENANCE"):
        plan_type = "INSTALL"

    payload = PlanningJobCreate(
        plan_type=plan_type,
        job_name=order.client_name or f"Order {order.order_id}",
        work_order_id=order.order_id,
        job_date=job_date_str,
        create_calendar_event=False,
        notes="Auto-generated from work order activity",
    )
    return create_planning_job_service(db, payload, current_user_id)


def start_order_service(db: Session, order_id: str, current_user_id: str | None = None):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "CREATED":
        raise HTTPException(
            status_code=400,
            detail=f"Only CREATED orders can be started. Current status={order.status}"
        )

    order.status = "IN_PROGRESS"
    order.updated_at = datetime.utcnow()
    _ensure_planning_job_for_order(db, order, current_user_id)

    db.commit()
    db.refresh(order)
    return order


def complete_order_service(db: Session, order_id: str, current_user_id: str | None = None):
    order = db.query(OrderTable).filter(OrderTable.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Order is already completed"
        )

    order.status = "COMPLETED"
    order.updated_at = datetime.utcnow()
    order.paid_at = datetime.utcnow()

    _ensure_planning_job_for_order(db, order, current_user_id)

    db.commit()
    db.refresh(order)
    return order
