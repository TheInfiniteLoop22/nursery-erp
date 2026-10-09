from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_admin
from app.models.event import EventTable
from app.models.order_table import OrderTable
from app.models.planning import PlanningCostEntry, PlanningJob, PlanningLaborEntry
from app.models.user import UserTable
from app.services.planning_service import _new_id, _new_event_id, _validate_plan_refs, create_planning_job_service
from app.schemas.planning_schema import (
    ALL_PLANNING_CATEGORIES,
    INSTALL_CATEGORIES,
    MAINTENANCE_CATEGORIES,
    PlanningCostEntryCreate,
    PlanningCostEntryResponse,
    PlanningCostEntryUpdate,
    PlanningJobCreate,
    PlanningJobListResponse,
    PlanningJobResponse,
    PlanningJobUpdate,
    PlanningLaborEntryCreate,
    PlanningLaborEntryResponse,
    PlanningLaborEntryUpdate,
    PlanningLaborBulkSaveRequest,
    PlanningLaborBulkEntry,
    PlanningTotals,
)

router = APIRouter()


def _enum_value(value):
    return value.value if hasattr(value, "value") else str(value)

def _money(value) -> Decimal:
    return Decimal(value or 0)

def _decimal_str(value) -> str:
    return str(_money(value).quantize(Decimal("0.01")))


def _get_plan_or_404(db: Session, plan_id: str) -> PlanningJob:
    plan = db.query(PlanningJob).filter(PlanningJob.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Planning job not found")
    return plan


def _get_labor_or_404(db: Session, plan_id: str, labor_entry_id: str) -> PlanningLaborEntry:
    entry = db.query(PlanningLaborEntry).filter(
        PlanningLaborEntry.plan_id == plan_id,
        PlanningLaborEntry.labor_entry_id == labor_entry_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Planning labor entry not found")
    return entry


def _get_cost_or_404(db: Session, plan_id: str, cost_entry_id: str) -> PlanningCostEntry:
    entry = db.query(PlanningCostEntry).filter(
        PlanningCostEntry.plan_id == plan_id,
        PlanningCostEntry.cost_entry_id == cost_entry_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Planning cost entry not found")
    return entry


def _validate_employee(db: Session, employee_id: str) -> UserTable:
    employee = db.query(UserTable).filter(
        UserTable.user_id == employee_id,
        UserTable.role.in_(["employee", "nursery", "head_installation", "head_maintenance"]),
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def _user_can_manage_plan(user: UserTable, plan_type: str) -> bool:
    normalized_type = _enum_value(plan_type)
    if user.role == "admin":
        return True
    if user.role == "head_installation" and normalized_type == "INSTALL":
        return True
    if user.role == "head_maintenance" and normalized_type == "MAINTENANCE":
        return True
    return False


def _require_plan_manager(user: UserTable, plan_type: str) -> None:
    if not _user_can_manage_plan(user, plan_type):
        raise HTTPException(status_code=403, detail="Access denied")


def _require_planning_admin(user: UserTable) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _validate_plan_work_order_type(db: Session, plan_type: str, work_order_id: str | None) -> None:
    if not work_order_id:
        return
    order = db.query(OrderTable.order_id, OrderTable.work_order_type).filter(OrderTable.order_id == work_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Linked work order not found")
    if _enum_value(plan_type) != _enum_value(order.work_order_type):
        raise HTTPException(status_code=400, detail="Plan type must match linked work order type")


def _validate_category(plan_type: str, category: str) -> None:
    normalized_type = _enum_value(plan_type)
    if normalized_type == "MAINTENANCE" and category not in MAINTENANCE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid maintenance labor category")
    if normalized_type == "INSTALL" and category not in INSTALL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid install labor category")
    if normalized_type not in ("MAINTENANCE", "INSTALL") and category not in ALL_PLANNING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid labor category")


def _invalid_categories_for_plan_type(plan_type: str, categories: list[str]) -> list[str]:
    normalized_type = _enum_value(plan_type)
    allowed = MAINTENANCE_CATEGORIES if normalized_type == "MAINTENANCE" else INSTALL_CATEGORIES
    return sorted({category for category in categories if category not in allowed})


def _ensure_plan_type_change_is_safe(db: Session, plan: PlanningJob, next_plan_type: str) -> None:
    if _enum_value(plan.plan_type) == next_plan_type:
        return

    categories = [
        row[0]
        for row in db.query(PlanningLaborEntry.category)
        .filter(PlanningLaborEntry.plan_id == plan.plan_id)
        .distinct()
        .all()
    ]
    invalid_categories = _invalid_categories_for_plan_type(next_plan_type, categories)
    if invalid_categories:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot change plan type because existing labor categories do not fit "
                f"{next_plan_type}: {', '.join(invalid_categories)}"
            ),
        )


def _cost_total(quantity: Decimal, unit_cost: Decimal, hours: Decimal | None = None) -> Decimal:
    billable_amount = _money(hours) if hours is not None else _money(quantity)
    return billable_amount * _money(unit_cost)


def _labor_response(entry: PlanningLaborEntry, usernames: dict[str, str] | None = None) -> PlanningLaborEntryResponse:
    planned_hours = _money(entry.planned_hours)
    actual_hours = _money(entry.actual_hours)
    hourly_rate = _money(entry.hourly_rate)
    return PlanningLaborEntryResponse(
        labor_entry_id=entry.labor_entry_id,
        plan_id=entry.plan_id,
        employee_id=entry.employee_id,
        employee_username=(usernames or {}).get(entry.employee_id),
        category=entry.category,
        planned_hours=_decimal_str(planned_hours),
        actual_hours=_decimal_str(actual_hours),
        hourly_rate=_decimal_str(hourly_rate),
        planned_labor_total=_decimal_str(planned_hours * hourly_rate),
        actual_labor_total=_decimal_str(actual_hours * hourly_rate),
        notes=entry.notes,
        created_at=str(entry.created_at),
        updated_at=str(entry.updated_at),
    )


def _cost_response(entry: PlanningCostEntry) -> PlanningCostEntryResponse:
    return PlanningCostEntryResponse(
        cost_entry_id=entry.cost_entry_id,
        plan_id=entry.plan_id,
        cost_type=_enum_value(entry.cost_type),
        description=entry.description,
        quantity=_decimal_str(entry.quantity),
        hours=_decimal_str(entry.hours) if entry.hours is not None else None,
        unit_cost=_decimal_str(entry.unit_cost),
        supplier=entry.supplier,
        planned_total=_decimal_str(entry.planned_total),
        actual_total=_decimal_str(entry.actual_total),
        notes=entry.notes,
        created_at=str(entry.created_at),
        updated_at=str(entry.updated_at),
    )


def _plan_response(db: Session, plan: PlanningJob, include_entries: bool = True) -> PlanningJobResponse:
    labor_entries = db.query(PlanningLaborEntry).filter(PlanningLaborEntry.plan_id == plan.plan_id).all()
    cost_entries = db.query(PlanningCostEntry).filter(PlanningCostEntry.plan_id == plan.plan_id).all()

    employee_ids = sorted({entry.employee_id for entry in labor_entries})
    usernames = {}
    if employee_ids:
        users = db.query(UserTable.user_id, UserTable.user_username).filter(UserTable.user_id.in_(employee_ids)).all()
        usernames = {user_id: username for user_id, username in users}

    planned_hours = sum((_money(entry.planned_hours) for entry in labor_entries), Decimal("0"))
    actual_hours = sum((_money(entry.actual_hours) for entry in labor_entries), Decimal("0"))
    planned_labor_total = sum((_money(entry.planned_hours) * _money(entry.hourly_rate) for entry in labor_entries), Decimal("0"))
    actual_labor_total = sum((_money(entry.actual_hours) * _money(entry.hourly_rate) for entry in labor_entries), Decimal("0"))
    planned_cost_total = sum((_money(entry.planned_total) for entry in cost_entries), Decimal("0"))
    actual_cost_total = sum((_money(entry.actual_total) for entry in cost_entries), Decimal("0"))

    client_name = None
    if plan.work_order_id:
        order = db.query(OrderTable.client_name).filter(OrderTable.order_id == plan.work_order_id).first()
        if order:
            client_name = order[0]

    return PlanningJobResponse(
        plan_id=plan.plan_id,
        plan_type=_enum_value(plan.plan_type),
        status=_enum_value(plan.status),
        job_name=plan.job_name,
        location=plan.location,
        work_order_id=plan.work_order_id,
        client_name=client_name,
        event_id=plan.event_id,
        job_date=plan.job_date,
        time_in=plan.time_in,
        time_out=plan.time_out,
        prepared_by=plan.prepared_by,
        billable=bool(plan.billable),
        notes=plan.notes,
        created_by=plan.created_by,
        created_at=str(plan.created_at),
        updated_at=str(plan.updated_at),
        totals=PlanningTotals(
            planned_hours=_decimal_str(planned_hours),
            actual_hours=_decimal_str(actual_hours),
            planned_labor_total=_decimal_str(planned_labor_total),
            actual_labor_total=_decimal_str(actual_labor_total),
            planned_cost_total=_decimal_str(planned_cost_total),
            actual_cost_total=_decimal_str(actual_cost_total),
            planned_grand_total=_decimal_str(planned_labor_total + planned_cost_total),
            actual_grand_total=_decimal_str(actual_labor_total + actual_cost_total),
        ),
        labor_entries=[_labor_response(entry, usernames) for entry in labor_entries] if include_entries else [],
        cost_entries=[_cost_response(entry) for entry in cost_entries] if include_entries else [],
    )


def _validate_category(plan_type: str, category: str) -> None:
    normalized_type = _enum_value(plan_type)
    if normalized_type == "MAINTENANCE" and category not in MAINTENANCE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid maintenance labor category")
    if normalized_type == "INSTALL" and category not in INSTALL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid install labor category")
    if normalized_type not in ("MAINTENANCE", "INSTALL") and category not in ALL_PLANNING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid labor category")


def _invalid_categories_for_plan_type(plan_type: str, categories: list[str]) -> list[str]:
    normalized_type = _enum_value(plan_type)
    allowed = MAINTENANCE_CATEGORIES if normalized_type == "MAINTENANCE" else INSTALL_CATEGORIES
    return sorted({category for category in categories if category not in allowed})


def _ensure_plan_type_change_is_safe(db: Session, plan: PlanningJob, next_plan_type: str) -> None:
    if _enum_value(plan.plan_type) == next_plan_type:
        return

    categories = [
        row[0]
        for row in db.query(PlanningLaborEntry.category)
        .filter(PlanningLaborEntry.plan_id == plan.plan_id)
        .distinct()
        .all()
    ]
    invalid_categories = _invalid_categories_for_plan_type(next_plan_type, categories)
    if invalid_categories:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot change plan type because existing labor categories do not fit "
                f"{next_plan_type}: {', '.join(invalid_categories)}"
            ),
        )


def _cost_total(quantity: Decimal, unit_cost: Decimal, hours: Decimal | None = None) -> Decimal:
    billable_amount = _money(hours) if hours is not None else _money(quantity)
    return billable_amount * _money(unit_cost)


def _labor_response(entry: PlanningLaborEntry, usernames: dict[str, str] | None = None) -> PlanningLaborEntryResponse:
    planned_hours = _money(entry.planned_hours)
    actual_hours = _money(entry.actual_hours)
    hourly_rate = _money(entry.hourly_rate)
    return PlanningLaborEntryResponse(
        labor_entry_id=entry.labor_entry_id,
        plan_id=entry.plan_id,
        employee_id=entry.employee_id,
        employee_username=(usernames or {}).get(entry.employee_id),
        category=entry.category,
        planned_hours=_decimal_str(planned_hours),
        actual_hours=_decimal_str(actual_hours),
        hourly_rate=_decimal_str(hourly_rate),
        planned_labor_total=_decimal_str(planned_hours * hourly_rate),
        actual_labor_total=_decimal_str(actual_hours * hourly_rate),
        notes=entry.notes,
        created_at=str(entry.created_at),
        updated_at=str(entry.updated_at),
    )


def _cost_response(entry: PlanningCostEntry) -> PlanningCostEntryResponse:
    return PlanningCostEntryResponse(
        cost_entry_id=entry.cost_entry_id,
        plan_id=entry.plan_id,
        cost_type=_enum_value(entry.cost_type),
        description=entry.description,
        quantity=_decimal_str(entry.quantity),
        hours=_decimal_str(entry.hours) if entry.hours is not None else None,
        unit_cost=_decimal_str(entry.unit_cost),
        supplier=entry.supplier,
        planned_total=_decimal_str(entry.planned_total),
        actual_total=_decimal_str(entry.actual_total),
        notes=entry.notes,
        created_at=str(entry.created_at),
        updated_at=str(entry.updated_at),
    )




@router.get("/", response_model=PlanningJobListResponse)
def list_planning_jobs(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    plan_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    work_order_id: str | None = Query(default=None),
):
    page = max(1, page)
    page_size = min(1000, max(1, page_size)) # Allow larger page size for frontend aggregation
    query = db.query(PlanningJob)

    if current_user.role == "head_installation":
        query = query.filter(PlanningJob.plan_type == "INSTALL")
    elif current_user.role == "head_maintenance":
        query = query.filter(PlanningJob.plan_type == "MAINTENANCE")
    elif current_user.role != "admin":
        employee_plan_ids = db.query(PlanningLaborEntry.plan_id).filter(
            PlanningLaborEntry.employee_id == current_user.user_id
        )
        query = query.filter(PlanningJob.plan_id.in_(employee_plan_ids))

    if plan_type:
        normalized = plan_type.strip().upper()
        if normalized in ("MAINTENANCE", "INSTALL"):
            query = query.filter(PlanningJob.plan_type == normalized)
    if status:
        normalized = status.strip().upper()
        if normalized in ("DRAFT", "SCHEDULED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "COMPLETED"):
            query = query.filter(PlanningJob.status == normalized)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((PlanningJob.job_name.ilike(term)) | (PlanningJob.location.ilike(term)))
    if date_from:
        query = query.filter(PlanningJob.job_date >= date_from)
    if date_to:
        query = query.filter(PlanningJob.job_date <= date_to)
    if work_order_id and work_order_id.strip():
        query = query.filter(PlanningJob.work_order_id == work_order_id.strip())

    total = query.with_entities(func.count(PlanningJob.plan_id)).scalar() or 0
    rows = query.order_by(PlanningJob.job_date.desc(), PlanningJob.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return PlanningJobListResponse(
        items=[_plan_response(db, plan, include_entries=True) for plan in rows],
        total=int(total),
        page=page,
        page_size=page_size,
        total_pages=int(total_pages),
    )


@router.post("/", response_model=PlanningJobResponse)
def create_planning_job(
    payload: PlanningJobCreate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_plan_manager(current_user, payload.plan_type)
    _validate_plan_work_order_type(db, payload.plan_type, payload.work_order_id)
    plan = create_planning_job_service(db, payload, current_user.user_id)
    return _plan_response(db, plan)


@router.get("/{plan_id}", response_model=PlanningJobResponse)
def get_planning_job(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    plan = _get_plan_or_404(db, plan_id)
    if current_user.role == "head_installation" and _enum_value(plan.plan_type) != "INSTALL":
        raise HTTPException(status_code=403, detail="Access denied: Installation head can only view installation plans")
    elif current_user.role == "head_maintenance" and _enum_value(plan.plan_type) != "MAINTENANCE":
        raise HTTPException(status_code=403, detail="Access denied: Maintenance head can only view maintenance plans")
    elif current_user.role not in ("admin", "head_installation", "head_maintenance"):
        assigned = db.query(PlanningLaborEntry.labor_entry_id).filter(
            PlanningLaborEntry.plan_id == plan_id,
            PlanningLaborEntry.employee_id == current_user.user_id,
        ).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="Access denied")
    return _plan_response(db, plan)


@router.patch("/{plan_id}", response_model=PlanningJobResponse)
def update_planning_job(
    plan_id: str,
    payload: PlanningJobUpdate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    from app.services.planning_service import update_planning_job_service
    plan = _get_plan_or_404(db, plan_id)
    _require_plan_manager(current_user, plan.plan_type)
    _validate_plan_refs(db, payload)
    updates = payload.model_dump(exclude_unset=True)
    if "plan_type" in updates:
        _ensure_plan_type_change_is_safe(db, plan, updates["plan_type"])
    target_plan_type = updates.get("plan_type", _enum_value(plan.plan_type))
    target_work_order_id = updates.get("work_order_id", plan.work_order_id)
    _validate_plan_work_order_type(db, target_plan_type, target_work_order_id)
    
    plan = update_planning_job_service(db, plan, updates, current_user.user_id)
    return _plan_response(db, plan)


@router.delete("/{plan_id}")
def delete_planning_job(
    plan_id: str,
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin),
):
    plan = _get_plan_or_404(db, plan_id)
    if not force:
        labor_count = db.query(func.count(PlanningLaborEntry.labor_entry_id)).filter(
            PlanningLaborEntry.plan_id == plan_id
        ).scalar() or 0
        cost_count = db.query(func.count(PlanningCostEntry.cost_entry_id)).filter(
            PlanningCostEntry.plan_id == plan_id
        ).scalar() or 0
        if labor_count or cost_count:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Planning job has labor or cost entries. Delete those entries first, "
                    "or call this endpoint with force=true."
                ),
            )
    db.delete(plan)
    db.commit()
    return {"message": "Planning job deleted", "plan_id": plan_id}


@router.post("/work-order/{work_order_id}/submit", status_code=200)
def submit_planning_for_work_order(
    work_order_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    """Mark all planning jobs for a work order as SUBMITTED (locked for admin review)."""
    query = db.query(PlanningJob).filter(PlanningJob.work_order_id == work_order_id)
    if current_user.role == "head_installation":
        query = query.filter(PlanningJob.plan_type == "INSTALL")
    elif current_user.role == "head_maintenance":
        query = query.filter(PlanningJob.plan_type == "MAINTENANCE")
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    plans = query.all()
    if not plans:
        raise HTTPException(status_code=404, detail="No planning jobs found for this work order")

    locked_statuses = {"SUBMITTED", "APPROVED", "COMPLETED"}
    submitted_count = 0
    for plan in plans:
        if _enum_value(plan.status) not in locked_statuses:
            plan.status = "SUBMITTED"
            submitted_count += 1

    if submitted_count > 0:
        from app.services import notification_service
        client_name = "Unknown Client"
        first_plan = plans[0]
        if first_plan.work_order_id:
            order = db.query(OrderTable).filter(OrderTable.order_id == first_plan.work_order_id).first()
            if order:
                client_name = order.client_name

        department = "Maintenance" if _enum_value(first_plan.plan_type) == "MAINTENANCE" else "Installation"

        notification_service.create_notification(
            db=db,
            type="plan_submitted",
            title="Day Sheet Submitted for Review",
            message=f"Day Sheet for Work Order {work_order_id} ({department}) for {client_name} has been submitted for admin review.",
            reference_id=work_order_id,
            actor_user_id=current_user.user_id,
        )

    db.commit()
    return {"message": f"Submitted {submitted_count} plan(s) for work order {work_order_id}", "work_order_id": work_order_id, "submitted_count": submitted_count}


@router.post("/work-order/{work_order_id}/approve", status_code=200)
def approve_planning_for_work_order(
    work_order_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin),
):
    """Admin approves all SUBMITTED planning jobs for a work order."""
    plans = db.query(PlanningJob).filter(
        PlanningJob.work_order_id == work_order_id,
        PlanningJob.status == "SUBMITTED",
    ).all()
    approved_count = 0
    for plan in plans:
        plan.status = "APPROVED"
        approved_count += 1

    if approved_count > 0:
        from app.services import notification_service
        first_plan = plans[0]
        department = "Maintenance" if _enum_value(first_plan.plan_type) == "MAINTENANCE" else "Installation"

        notification_service.create_notification(
            db=db,
            type="plan_completed",
            title="Day Sheet Approved",
            message=f"Day Sheet for Work Order {work_order_id} ({department}) has been approved by the admin.",
            reference_id=work_order_id,
            actor_user_id=current_user.user_id,
        )

    db.commit()
    return {"message": f"Approved {approved_count} plan(s) for work order {work_order_id}", "work_order_id": work_order_id, "approved_count": approved_count}



@router.post("/{plan_id}/labor", response_model=PlanningLaborEntryResponse)
def create_labor_entry(
    plan_id: str,
    payload: PlanningLaborEntryCreate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    plan = _get_plan_or_404(db, plan_id)
    _require_plan_manager(current_user, plan.plan_type)
    locked_statuses = {"SUBMITTED", "APPROVED", "COMPLETED"}
    if _enum_value(plan.status) in locked_statuses and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="This plan is locked and can no longer be edited")
    employee = _validate_employee(db, payload.employee_id)
    _validate_category(_enum_value(plan.plan_type), payload.category)
    entry = PlanningLaborEntry(
        labor_entry_id=_new_id("labor"),
        plan_id=plan_id,
        employee_id=payload.employee_id,
        category=payload.category,
        planned_hours=payload.planned_hours,
        actual_hours=payload.actual_hours,
        hourly_rate=employee.hourly_rate * (employee.hourly_rate_multiplier if employee.hourly_rate_multiplier is not None else Decimal("1.0")),
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _labor_response(entry)


@router.post("/{plan_id}/labor/bulk", response_model=list[PlanningLaborEntryResponse])
def save_bulk_labor(
    plan_id: str,
    payload: PlanningLaborBulkSaveRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    plan = _get_plan_or_404(db, plan_id)
    _require_plan_manager(current_user, plan.plan_type)
    locked_statuses = {"SUBMITTED", "APPROVED", "COMPLETED"}
    if _enum_value(plan.status) in locked_statuses and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="This plan is locked and can no longer be edited")

    employee = _validate_employee(db, payload.employee_id)
    
    # 1. Fetch all existing entries for this employee in this plan
    existing_entries = db.query(PlanningLaborEntry).filter(
        PlanningLaborEntry.plan_id == plan_id,
        PlanningLaborEntry.employee_id == payload.employee_id
    ).all()
    
    existing_entry_map = {entry.labor_entry_id: entry for entry in existing_entries}
    
    # 2. Deletions: find entries to remove
    incoming_ids = {item.labor_entry_id for item in payload.entries if item.labor_entry_id}
    for entry_id, entry in existing_entry_map.items():
        if entry_id not in incoming_ids:
            db.delete(entry)
            
    # 3. Additions / Updates
    result_entries = []
    for item in payload.entries:
        _validate_category(_enum_value(plan.plan_type), item.category)
        if item.labor_entry_id and item.labor_entry_id in existing_entry_map:
            # Update existing
            entry = existing_entry_map[item.labor_entry_id]
            entry.category = item.category
            entry.planned_hours = item.planned_hours
            entry.actual_hours = item.actual_hours
            entry.notes = item.notes
        else:
            # Create new
            entry = PlanningLaborEntry(
                labor_entry_id=_new_id("labor"),
                plan_id=plan_id,
                employee_id=payload.employee_id,
                category=item.category,
                planned_hours=item.planned_hours,
                actual_hours=item.actual_hours,
                hourly_rate=employee.hourly_rate * (employee.hourly_rate_multiplier if employee.hourly_rate_multiplier is not None else Decimal("1.0")),
                notes=item.notes,
            )
            db.add(entry)
        result_entries.append(entry)
        
    db.commit()
    
    # Refresh result entries and build response
    for entry in result_entries:
        db.refresh(entry)
        
    # Get usernames map for response formatting
    users = db.query(UserTable.user_id, UserTable.user_username).filter(UserTable.user_id == payload.employee_id).all()
    usernames = {user_id: username for user_id, username in users}
    
    return [_labor_response(entry, usernames) for entry in result_entries]



@router.patch("/{plan_id}/labor/{labor_entry_id}", response_model=PlanningLaborEntryResponse)
def update_labor_entry(
    plan_id: str,
    labor_entry_id: str,
    payload: PlanningLaborEntryUpdate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    plan = _get_plan_or_404(db, plan_id)
    entry = _get_labor_or_404(db, plan_id, labor_entry_id)
    updates = payload.model_dump(exclude_unset=True)

    locked_statuses = {"SUBMITTED", "APPROVED", "COMPLETED"}
    if _enum_value(plan.status) in locked_statuses and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="This plan is locked and can no longer be edited")

    if _user_can_manage_plan(current_user, plan.plan_type):
        pass
    elif current_user.role != "admin":
        if entry.employee_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        disallowed = set(updates.keys()) - {"actual_hours", "notes"}
        if disallowed:
            raise HTTPException(
                status_code=403,
                detail="Employees can only update actual_hours and notes for their own labor entries",
            )

    if "employee_id" in updates:
        employee = _validate_employee(db, updates["employee_id"])
        entry.employee_id = updates["employee_id"]
        entry.hourly_rate = employee.hourly_rate
    if "category" in updates:
        _validate_category(_enum_value(plan.plan_type), updates["category"])
    if "hourly_rate" in updates:
        raise HTTPException(status_code=400, detail="Hourly rate is managed from the employee profile and cannot be updated directly here")
    for field, value in updates.items():
        if field == "employee_id":
            continue
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return _labor_response(entry)


@router.delete("/{plan_id}/labor/{labor_entry_id}")
def delete_labor_entry(
    plan_id: str,
    labor_entry_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    """Delete a planning labor entry."""
    plan = _get_plan_or_404(db, plan_id)
    _require_plan_manager(current_user, plan.plan_type)

    locked_statuses = {"SUBMITTED", "APPROVED", "COMPLETED"}
    if _enum_value(plan.status) in locked_statuses and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="This plan is locked and can no longer be edited")

    entry = _get_labor_or_404(db, plan_id, labor_entry_id)
    db.delete(entry)
    db.commit()
    return {"message": "Planning labor entry deleted", "labor_entry_id": labor_entry_id}


@router.post("/{plan_id}/costs", response_model=PlanningCostEntryResponse)
def create_cost_entry(
    plan_id: str,
    payload: PlanningCostEntryCreate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    """Create a planning cost entry."""
    plan = _get_plan_or_404(db, plan_id)
    _require_planning_admin(current_user)

    calculated_total = _cost_total(payload.quantity, payload.unit_cost, payload.hours)
    entry = PlanningCostEntry(
        cost_entry_id=_new_id("cost"),
        plan_id=plan_id,
        cost_type=payload.cost_type,
        description=payload.description,
        quantity=payload.quantity,
        hours=payload.hours,
        unit_cost=payload.unit_cost,
        supplier=payload.supplier,
        planned_total=payload.planned_total if payload.planned_total is not None else calculated_total,
        actual_total=payload.actual_total if payload.actual_total is not None else calculated_total,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _cost_response(entry)



@router.patch("/{plan_id}/costs/{cost_entry_id}", response_model=PlanningCostEntryResponse)
def update_cost_entry(
    plan_id: str,
    cost_entry_id: str,
    payload: PlanningCostEntryUpdate,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_planning_admin(current_user)
    entry = _get_cost_or_404(db, plan_id, cost_entry_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entry, field, value)

    if "planned_total" not in updates and ({"quantity", "hours", "unit_cost"} & set(updates.keys())):
        entry.planned_total = _cost_total(entry.quantity, entry.unit_cost, entry.hours)
    if "actual_total" not in updates and ({"quantity", "hours", "unit_cost"} & set(updates.keys())):
        entry.actual_total = _cost_total(entry.quantity, entry.unit_cost, entry.hours)

    db.commit()
    db.refresh(entry)
    return _cost_response(entry)


@router.delete("/{plan_id}/costs/{cost_entry_id}")
def delete_cost_entry(
    plan_id: str,
    cost_entry_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_planning_admin(current_user)
    entry = _get_cost_or_404(db, plan_id, cost_entry_id)
    db.delete(entry)
    db.commit()
    return {"message": "Planning cost entry deleted", "cost_entry_id": cost_entry_id}
