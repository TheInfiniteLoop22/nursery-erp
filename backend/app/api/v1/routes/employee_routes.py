from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.deps import get_db, get_current_user, require_admin
from app.models.user import UserTable
from app.models.employee_scan_log import EmployeeScanLog
from app.models.order_table import OrderTable
from app.models.product import Product
from app.models.notification import Notification
from app.schemas.employee_schema import EmployeeCreateRequest, EmployeeCreateResponse, EmployeeUpdateRequest
from app.core.security import hash_password
from app.core.id_generator import generate_user_id
from sqlalchemy import func
from app.utils.size_formatter import extract_view_dimensions

router = APIRouter()


@router.post("/create", response_model=EmployeeCreateResponse)
def create_employee(
    payload: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin)
):
    """Create a new employee account"""
    requested_role = (payload.role or "employee").strip().lower()
    if requested_role not in ["employee", "nursery", "head_installation", "head_maintenance"]:
        raise HTTPException(status_code=400, detail="Role must be employee, nursery, head_installation, or head_maintenance")

    # Check if username already exists
    existing = db.query(UserTable).filter(UserTable.user_username == payload.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    
    # Generate user ID for selected role
    employee_id = generate_user_id(db, requested_role)
    
    # Create new employee
    new_employee = UserTable(
        user_id=employee_id,
        user_username=payload.username,
        user_password=hash_password(payload.password),
        role=requested_role,
        hourly_rate=payload.hourly_rate,
        hourly_rate_multiplier=payload.hourly_rate_multiplier,
    )
    
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    
    return EmployeeCreateResponse(
        employee_id=new_employee.user_id,
        username=new_employee.user_username,
        role=new_employee.role,
        message=f"{new_employee.role.capitalize()} user created successfully"
    )


@router.get("/employees")
def get_all_employees(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = Query(default=None),
):
    """Get all employees with their statistics"""
    if current_user.role not in ("admin", "head_installation", "head_maintenance"):
        raise HTTPException(status_code=403, detail="Access denied")

    page = max(1, page)
    page_size = min(100, max(1, page_size))

    query = db.query(UserTable).filter(UserTable.role.in_(["employee", "nursery", "head_installation", "head_maintenance"]))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (UserTable.user_username.ilike(term))
            | (UserTable.user_id.ilike(term))
        )
    if status and status.strip().lower() in ("active", "inactive"):
        # Current system stores all users as active; keep contract for future support.
        if status.strip().lower() == "inactive":
            query = query.filter(False)

    total = query.with_entities(func.count(UserTable.user_id)).scalar() or 0
    offset = (page - 1) * page_size
    employees = (
        query
        .order_by(UserTable.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    
    result = []
    for emp in employees:
        # Get scan logs count
        scans_count = db.query(func.count(EmployeeScanLog.scan_id)).filter(
            EmployeeScanLog.employee_id == emp.user_id
        ).scalar() or 0
        
        # Get completed orders count (orders that this employee worked on and are completed)
        completed_orders = db.query(func.count(func.distinct(EmployeeScanLog.order_id))).join(
            OrderTable, EmployeeScanLog.order_id == OrderTable.order_id
        ).filter(
            EmployeeScanLog.employee_id == emp.user_id,
            OrderTable.status == "COMPLETED"
        ).scalar() or 0
        
        result.append({
            "employee_id": emp.user_id,
            "username": emp.user_username,
            "role": emp.role,
            "hourly_rate": str(emp.hourly_rate or 0),
            "hourly_rate_multiplier": str(emp.hourly_rate_multiplier or 1.0),
            "created_at": emp.created_at,
            "items_scanned": scans_count,
            "orders_completed": completed_orders,
            "status": "active"  # You can add a status field to UserTable if needed
        })
    
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": result,
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/employees/{employee_id}")
def get_employee_detail(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    """Get detailed information about a specific employee"""
    if current_user.role not in ("admin", "head_installation", "head_maintenance"):
        raise HTTPException(status_code=403, detail="Access denied")

    employee = db.query(UserTable).filter(
        UserTable.user_id == employee_id,
        UserTable.role.in_(["employee", "nursery", "head_installation", "head_maintenance"])
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get scan logs count
    scans_count = db.query(func.count(EmployeeScanLog.scan_id)).filter(
        EmployeeScanLog.employee_id == employee.user_id
    ).scalar() or 0

    total_inventory_updated = db.query(func.coalesce(func.sum(EmployeeScanLog.scanned_quantity), 0)).filter(
        EmployeeScanLog.employee_id == employee.user_id
    ).scalar() or 0
    
    # Get completed orders count
    completed_orders = db.query(func.count(func.distinct(EmployeeScanLog.order_id))).join(
        OrderTable, EmployeeScanLog.order_id == OrderTable.order_id
    ).filter(
        EmployeeScanLog.employee_id == employee.user_id,
        OrderTable.status == "COMPLETED"
    ).scalar() or 0
    
    # Get recent scan logs
    recent_scans = db.query(EmployeeScanLog).filter(
        EmployeeScanLog.employee_id == employee.user_id
    ).order_by(EmployeeScanLog.scanned_at.desc()).limit(10).all()

    scanned_products = db.query(
        EmployeeScanLog.product_id,
        Product.item_name,
        Product.section,
        Product.size,
        func.sum(EmployeeScanLog.scanned_quantity).label("total_scanned"),
        func.max(EmployeeScanLog.scanned_at).label("last_scanned_at"),
    ).join(
        Product, Product.product_id == EmployeeScanLog.product_id
    ).filter(
        EmployeeScanLog.employee_id == employee.user_id
    ).group_by(
        EmployeeScanLog.product_id,
        Product.item_name,
        Product.section,
        Product.size,
    ).order_by(
        func.max(EmployeeScanLog.scanned_at).desc()
    ).all()

    scanned_orders = db.query(
        EmployeeScanLog.order_id,
        OrderTable.client_name,
        OrderTable.status,
        func.count(EmployeeScanLog.scan_id).label("scan_events"),
        func.sum(EmployeeScanLog.scanned_quantity).label("total_scanned"),
        func.max(EmployeeScanLog.scanned_at).label("last_scanned_at"),
    ).join(
        OrderTable, OrderTable.order_id == EmployeeScanLog.order_id
    ).filter(
        EmployeeScanLog.employee_id == employee.user_id
    ).group_by(
        EmployeeScanLog.order_id,
        OrderTable.client_name,
        OrderTable.status,
    ).order_by(
        func.max(EmployeeScanLog.scanned_at).desc()
    ).all()

    inventory_updates = db.query(
        Notification.notification_id,
        Notification.title,
        Notification.message,
        Notification.reference_id,
        Notification.created_at,
        Product.item_name,
        Product.section,
        Product.size,
    ).outerjoin(
        Product, Product.product_id == Notification.reference_id
    ).filter(
        Notification.actor_user_id == employee.user_id,
        Notification.type == "inventory_update",
    ).order_by(
        Notification.created_at.desc()
    ).limit(50).all()

    products_added_count = db.query(
        func.count(func.distinct(Notification.reference_id))
    ).filter(
        Notification.actor_user_id == employee.user_id,
        Notification.type == "inventory_update",
    ).scalar() or 0
    
    return {
        "employee_id": employee.user_id,
        "username": employee.user_username,
        "role": employee.role,
        "hourly_rate": str(employee.hourly_rate or 0),
        "hourly_rate_multiplier": str(employee.hourly_rate_multiplier or 1.0),
        "created_at": employee.created_at,
        "items_scanned": scans_count,
        "orders_completed": completed_orders,
        "inventory_updated": int(total_inventory_updated),
        "products_added_count": int(products_added_count),
        "status": "active",
        "scanned_products": [
            {
                "product_id": row.product_id,
                "item_name": row.item_name,
                "size": row.size,
                "height_feet": extract_view_dimensions(row.section, row.size)[0],
                "caliper_inches": extract_view_dimensions(row.section, row.size)[1],
                "total_scanned": int(row.total_scanned or 0),
                "last_scanned_at": row.last_scanned_at,
            }
            for row in scanned_products
        ],
        "scanned_orders": [
            {
                "order_id": row.order_id,
                "client_name": row.client_name,
                "status": row.status.value if hasattr(row.status, "value") else str(row.status),
                "scan_events": int(row.scan_events or 0),
                "total_scanned": int(row.total_scanned or 0),
                "last_scanned_at": row.last_scanned_at,
            }
            for row in scanned_orders
        ],
        "inventory_updates": [
            {
                "notification_id": row.notification_id,
                "product_id": row.reference_id,
                "item_name": row.item_name,
                "size": row.size,
                "height_feet": extract_view_dimensions(row.section, row.size)[0],
                "caliper_inches": extract_view_dimensions(row.section, row.size)[1],
                "title": row.title,
                "message": row.message,
                "created_at": row.created_at,
            }
            for row in inventory_updates
        ],
        "recent_scans": [
            {
                "scan_id": log.scan_id,
                "order_id": log.order_id,
                "product_id": log.product_id,
                "scanned_quantity": log.scanned_quantity,
                "scanned_at": log.scanned_at
            }
            for log in recent_scans
        ]
    }


@router.patch("/employees/{employee_id}")
def update_employee(
    employee_id: str,
    payload: EmployeeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(require_admin)
):
    """Update employee details (e.g. hourly rate)"""
    employee = db.query(UserTable).filter(
        UserTable.user_id == employee_id,
        UserTable.role.in_(["employee", "nursery", "head_installation", "head_maintenance"])
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = payload.model_dump(exclude_unset=True)
    
    hourly_rate_changed = "hourly_rate" in updates or "hourly_rate_multiplier" in updates

    if "hourly_rate" in updates:
        employee.hourly_rate = updates["hourly_rate"]
    if "hourly_rate_multiplier" in updates:
        employee.hourly_rate_multiplier = updates["hourly_rate_multiplier"]

    if hourly_rate_changed:
        from decimal import Decimal
        new_base = employee.hourly_rate
        new_mult = employee.hourly_rate_multiplier if employee.hourly_rate_multiplier is not None else Decimal("1.0")
        new_final = new_base * new_mult
        
        # Update hourly rate of all active (non-approved, non-completed) plans' labor entries for this employee
        from app.models.planning import PlanningLaborEntry, PlanningJob
        db.query(PlanningLaborEntry).filter(
            PlanningLaborEntry.employee_id == employee.user_id
        ).filter(
            PlanningLaborEntry.plan_id.in_(
                db.query(PlanningJob.plan_id).filter(
                    PlanningJob.status.in_(["DRAFT", "SCHEDULED", "IN_PROGRESS", "SUBMITTED"])
                )
            )
        ).update(
            {PlanningLaborEntry.hourly_rate: new_final},
            synchronize_session=False
        )

    if "role" in updates:
        requested_role = updates["role"].strip().lower()
        if requested_role not in ["employee", "nursery", "head_installation", "head_maintenance"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        employee.role = requested_role

    db.commit()
    db.refresh(employee)
    return {
        "employee_id": employee.user_id,
        "username": employee.user_username,
        "role": employee.role,
        "hourly_rate": str(employee.hourly_rate),
        "hourly_rate_multiplier": str(employee.hourly_rate_multiplier),
        "message": "Employee updated successfully"
    }
