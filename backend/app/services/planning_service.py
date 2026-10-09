from sqlalchemy.orm import Session
from uuid import uuid4
from fastapi import HTTPException

from app.models.planning import PlanningJob
from app.models.event import EventTable
from app.models.order_table import OrderTable
from app.models.user import UserTable
from app.schemas.planning_schema import PlanningJobCreate


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def _new_event_id() -> str:
    return f"EVT{uuid4().hex[:12].upper()}"


def _validate_plan_refs(db: Session, payload) -> None:
    if getattr(payload, "work_order_id", None):
        exists = db.query(OrderTable.order_id).filter(OrderTable.order_id == payload.work_order_id).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Linked work order not found")
    if getattr(payload, "event_id", None):
        exists = db.query(EventTable.event_id).filter(EventTable.event_id == payload.event_id).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Linked calendar event not found")
    if getattr(payload, "prepared_by", None):
        exists = db.query(UserTable.user_id).filter(UserTable.user_id == payload.prepared_by).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Prepared-by user not found")


def create_planning_job_service(db: Session, payload: PlanningJobCreate, current_user_id: str) -> PlanningJob:
    _validate_plan_refs(db, payload)
    if payload.work_order_id:
        existing_plan = db.query(PlanningJob).filter(
            PlanningJob.work_order_id == payload.work_order_id,
            PlanningJob.job_date == payload.job_date,
        ).first()
        if existing_plan:
            return existing_plan

    event_id = payload.event_id
    if payload.create_calendar_event and not event_id:
        event = EventTable(
            event_id=_new_event_id(),
            event_name=f"{payload.plan_type.title()}: {payload.job_name}",
            event_date=payload.job_date,
            event_time=payload.time_in or "08:00",
            created_by=current_user_id,
        )
        db.add(event)
        event_id = event.event_id

    plan = PlanningJob(
        plan_id=_new_id("plan"),
        plan_type=payload.plan_type,
        job_name=payload.job_name,
        location=payload.location,
        work_order_id=payload.work_order_id,
        event_id=event_id,
        job_date=payload.job_date,
        time_in=payload.time_in,
        time_out=payload.time_out,
        prepared_by=payload.prepared_by,
        billable=payload.billable,
        notes=payload.notes,
        created_by=current_user_id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update_planning_job_service(
    db: Session,
    plan: PlanningJob,
    updates: dict,
    current_user_id: str,
) -> PlanningJob:
    from app.services import notification_service
    from app.models.notification import Notification

    old_status = plan.status.value if hasattr(plan.status, "value") else str(plan.status)

    for field, value in updates.items():
        setattr(plan, field, value)
    
    db.flush()

    new_status = plan.status.value if hasattr(plan.status, "value") else str(plan.status)

    if old_status != "COMPLETED" and new_status == "COMPLETED":
        # Check for duplicates
        existing_notification = (
            db.query(Notification)
            .filter(
                Notification.reference_id == plan.plan_id,
                Notification.type == "plan_completed"
            )
            .first()
        )
        if not existing_notification:
            # Optionally fetch the work order for details
            client_name = "Unknown Client"
            if plan.work_order_id:
                order = db.query(OrderTable).filter(OrderTable.order_id == plan.work_order_id).first()
                if order:
                    client_name = order.client_name
            
            department = "Maintenance" if (plan.plan_type.value if hasattr(plan.plan_type, "value") else str(plan.plan_type)) == "MAINTENANCE" else "Installation"

            notification_service.create_notification(
                db=db,
                type="plan_completed",
                title="Day Sheet Completed",
                message=f"Day Sheet for Work Order {plan.work_order_id or 'Unknown'} ({department}) for {client_name} has been marked complete.",
                reference_id=plan.plan_id,
                actor_user_id=current_user_id,
            )

    db.commit()
    db.refresh(plan)
    return plan
