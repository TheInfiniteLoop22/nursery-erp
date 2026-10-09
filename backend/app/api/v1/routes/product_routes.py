from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import get_db, get_current_user
from app.models.product import Product
from app.models.user import UserTable
from app.schemas.product_schema import (
    ProductCreateRequest,
    ProductCreateResponse,
    ProductAddStockRequest,
    ProductAddStockResponse,
    ProductUpdateRequest,
    ProductUpdateResponse,
    ProductDeleteResponse,
)
from app.schemas.product_view_schema import ProductView
from app.schemas.product_submission_schema import (
    ProductSubmissionCreateRequest,
    ProductSubmissionCreateResponse,
    ProductSubmissionView,
    ProductSubmissionApproveRequest,
    ProductSubmissionApproveResponse,
    ProductSubmissionBarcodeStatusRequest,
    ProductSubmissionBarcodeStatusResponse,
)
from app.services.notification_service import create_notification
from app.services.product_service import (
    add_product_service,
    add_stock_service,
    update_product_service,
    delete_product_service,
)
from app.services.product_submission_service import (
    create_product_submission,
    list_pending_product_submissions_paginated,
    list_pending_barcode_submissions_paginated,
    list_product_submissions_for_requester_paginated,
    get_product_submission,
    approve_product_submission,
    update_submission_barcode_status,
    pending_barcode_product_ids_query,
    is_product_live,
)
from app.utils.size_formatter import extract_view_dimensions

router = APIRouter()


def _normalize_barcode_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def _to_ean12_candidate(product_id: str) -> str:
    digits = _normalize_barcode_digits(product_id)
    if not digits:
        return "200000000000"
    if len(digits) >= 12:
        return digits[:12]
    return digits.zfill(12)


def _ean13_check_digit(ean12: str) -> str:
    if len(ean12) != 12 or not ean12.isdigit():
        return ""
    total = 0
    for idx, ch in enumerate(ean12):
        total += int(ch) * (1 if idx % 2 == 0 else 3)
    remainder = total % 10
    return "0" if remainder == 0 else str(10 - remainder)


@router.get("/all")
def show_all_products(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    nursery_ids: list[str] = Query(default=[]),
    sections: list[str] = Query(default=[]),
    live_only: bool = True,
):
    if user.role == "employee":
        raise HTTPException(status_code=403, detail="Employee access to product list is disabled")

    page = max(1, page)
    page_size = min(100, max(1, page_size))
    offset = (page - 1) * page_size

    query = db.query(Product)

    if live_only:
        pending_ids = pending_barcode_product_ids_query(db)
        query = query.filter(~Product.product_id.in_(pending_ids))

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (Product.item_name.ilike(term)) |
            (Product.product_id.ilike(term)) |
            (Product.size.ilike(term))
        )

    if nursery_ids:
        query = query.filter(Product.nursery_id.in_(nursery_ids))

    normalized_sections = {section.strip().lower() for section in sections if section and section.strip()}
    if normalized_sections:
        query = query.filter(func.lower(Product.section).in_(normalized_sections))

    total = query.with_entities(func.count(Product.product_id)).scalar() or 0
    products = (
        query
        .order_by(Product.item_name.asc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items: list[ProductView] = []
    for p in products:
        height_feet, caliper_inches = extract_view_dimensions(p.section, p.size)
        items.append(
            ProductView(
                product_id=p.product_id,
                nursery_id=p.nursery_id,
                item_name=p.item_name,
                section=p.section,
                zones=p.zones,
                subzone=p.subzone,
                size=p.size,
                height_feet=height_feet,
                caliper_inches=caliper_inches,
                gallons=p.gallons,
                inventory_quantity=p.inventory_quantity,
                ordered_quantity=p.ordered_quantity,
                base_price_per_unit=str(p.base_price_per_unit),
                rate_percentage=str(p.rate_percentage),
                image_url=p.image_url,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": items,
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/lookup/by-barcode", response_model=ProductView)
def show_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role not in ("admin", "nursery", "employee"):
        raise HTTPException(status_code=403, detail="Access denied")

    scanned_digits = _normalize_barcode_digits(barcode)
    if not scanned_digits:
        raise HTTPException(status_code=400, detail="Invalid barcode")

    products = db.query(Product).all()
    for product in products:
        ean12 = _to_ean12_candidate(product.product_id)
        ean13 = ean12 + _ean13_check_digit(ean12)
        scanned_trimmed = scanned_digits.lstrip("0") or "0"
        ean12_trimmed = ean12.lstrip("0") or "0"
        ean13_trimmed = ean13.lstrip("0") or "0"
        if (
            scanned_digits == ean13
            or scanned_digits == ean12
            or scanned_trimmed == ean13_trimmed
            or scanned_trimmed == ean12_trimmed
        ):
            if not is_product_live(db, product.product_id):
                raise HTTPException(
                    status_code=404,
                    detail="Product barcode is not active until labels are printed",
                )
            height_feet, caliper_inches = extract_view_dimensions(product.section, product.size)
            return ProductView(
                product_id=product.product_id,
                nursery_id=product.nursery_id,
                item_name=product.item_name,
                section=product.section,
                zones=product.zones,
                subzone=product.subzone,
                size=product.size,
                height_feet=height_feet,
                caliper_inches=caliper_inches,
                gallons=product.gallons,
                inventory_quantity=product.inventory_quantity,
                ordered_quantity=product.ordered_quantity,
                base_price_per_unit=str(product.base_price_per_unit),
                rate_percentage=str(product.rate_percentage),
                image_url=product.image_url,
            )

    raise HTTPException(status_code=404, detail="Product not found")


@router.get("/{product_id}", response_model=ProductView)
def show_product_by_id(
    product_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    height_feet, caliper_inches = extract_view_dimensions(product.section, product.size)

    return ProductView(
        product_id=product.product_id,
        nursery_id=product.nursery_id,
        item_name=product.item_name,
        section=product.section,
        zones=product.zones,
        subzone=product.subzone,
        size=product.size,
        height_feet=height_feet,
        caliper_inches=caliper_inches,
        gallons=product.gallons,
        inventory_quantity=product.inventory_quantity,
        ordered_quantity=product.ordered_quantity,
        base_price_per_unit=str(product.base_price_per_unit),
        rate_percentage=str(product.rate_percentage),
        image_url=product.image_url,
    )

@router.post("/add", response_model=ProductCreateResponse)
def add_product(
    payload: ProductCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    product = add_product_service(
        db,
        payload,
        actor_role=current_user.role,
        merge_existing_inventory=False,
    )

    return ProductCreateResponse(
        product_id=product.product_id,
        message="Product added successfully "
    )


@router.post("/submit", response_model=ProductSubmissionCreateResponse)
def submit_product_for_review(
    payload: ProductSubmissionCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "nursery":
        raise HTTPException(status_code=403, detail="Nursery access required")

    submission = create_product_submission(db, payload, requester=current_user)
    return ProductSubmissionCreateResponse(
        submission_id=submission.submission_id,
        message="Product submitted for admin review",
    )


@router.get("/submissions/pending-barcode")
def get_pending_barcode_submissions(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 12,
    search: str | None = None,
    nursery_ids: list[str] = Query(default=[]),
    sections: list[str] = Query(default=[]),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    page = max(1, page)
    page_size = min(100, max(1, page_size))
    submissions, total = list_pending_barcode_submissions_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
        nursery_ids=nursery_ids or None,
        sections=sections or None,
    )
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": [_submission_to_view(db, item) for item in submissions],
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/submissions/pending")
def get_pending_submissions(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 12,
    search: str | None = None,
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    page = max(1, page)
    page_size = min(100, max(1, page_size))
    submissions, total = list_pending_product_submissions_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
    )
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": [_submission_to_view(db, item) for item in submissions],
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }

def _submission_to_view(db: Session, item):
    employee = db.query(UserTable).filter(UserTable.user_id == item.employee_id).first()
    height_feet, caliper_inches = extract_view_dimensions(item.section, item.size)
    return ProductSubmissionView(
        submission_id=item.submission_id,
        employee_id=item.employee_id,
        employee_username=employee.user_username if employee else item.employee_id,
        nursery_id=item.nursery_id,
        item_name=item.item_name,
        section=item.section,
        zones=item.zones,
        subzone=item.subzone,
        size=item.size,
        height_feet=height_feet,
        caliper_inches=caliper_inches,
        gallons=item.gallons,
        inventory_quantity=item.inventory_quantity,
        image_url=item.image_url,
        status=item.status,
        approved_product_id=item.approved_product_id,
        barcode_status=item.barcode_status,
        barcode_printed_at=item.barcode_printed_at,
        barcode_printed_by=item.barcode_printed_by,
        reviewed_by=item.reviewed_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

@router.get("/submissions/mine")
def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    status: str | None = None,
):
    if current_user.role != "nursery":
        raise HTTPException(status_code=403, detail="Nursery access required")

    page = max(1, page)
    page_size = min(100, max(1, page_size))
    submissions, total = list_product_submissions_for_requester_paginated(
        db,
        current_user.user_id,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
    )
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": [_submission_to_view(db, item) for item in submissions],
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/submissions/{submission_id}", response_model=ProductSubmissionView)
def get_submission_by_id(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    item = get_product_submission(db, submission_id)
    if current_user.role == "nursery" and item.employee_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role not in ("admin", "nursery"):
        raise HTTPException(status_code=403, detail="Access denied")
    return _submission_to_view(db, item)


@router.post("/submissions/{submission_id}/approve", response_model=ProductSubmissionApproveResponse)
def approve_submission(
    submission_id: str,
    payload: ProductSubmissionApproveRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    submission = get_product_submission(db, submission_id)
    product = approve_product_submission(
        db,
        submission,
        reviewer=current_user,
        base_price_per_unit=payload.base_price_per_unit,
        rate_percentage=payload.rate_percentage,
        item_name=payload.item_name,
    )

    return ProductSubmissionApproveResponse(
        submission_id=submission.submission_id,
        product_id=product.product_id,
        message="Submission approved and product created",
    )


@router.patch("/submissions/{submission_id}/barcode-status", response_model=ProductSubmissionBarcodeStatusResponse)
def patch_submission_barcode_status(
    submission_id: str,
    payload: ProductSubmissionBarcodeStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role not in ("admin", "nursery"):
        raise HTTPException(status_code=403, detail="Access denied")

    submission = get_product_submission(db, submission_id)
    if current_user.role == "nursery" and submission.employee_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    updated = update_submission_barcode_status(
        db,
        submission,
        barcode_status=payload.barcode_status,
        actor_user_id=current_user.user_id,
        actor_role=current_user.role,
    )
    return ProductSubmissionBarcodeStatusResponse(
        submission_id=updated.submission_id,
        barcode_status=updated.barcode_status,
        message="Barcode status updated",
    )


@router.patch("/{product_id}/add-stock", response_model=ProductAddStockResponse)
def add_product_stock(
    product_id: str,
    payload: ProductAddStockRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role not in ["admin", "nursery"]:
        raise HTTPException(status_code=403, detail="Access denied")

    product = add_stock_service(db, product_id, payload.quantity)

    if current_user.role == "nursery":
        create_notification(
            db,
            type="inventory_update",
            title="Inventory Increased By Nursery",
            message=(
                f"{current_user.user_username} added {payload.quantity} units to "
                f"{product.item_name} ({product.product_id})"
            ),
            actor_user_id=current_user.user_id,
            reference_id=product.product_id,
        )
        db.commit()

    return ProductAddStockResponse(
        product_id=product.product_id,
        added_quantity=payload.quantity,
        inventory_quantity=product.inventory_quantity,
        message="Stock updated successfully",
    )


@router.patch("/{product_id}", response_model=ProductUpdateResponse)
def update_product(
    product_id: str,
    payload: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    product = update_product_service(db, product_id, payload)
    return ProductUpdateResponse(
        product_id=product.product_id,
        message="Product updated successfully",
    )


@router.delete("/{product_id}", response_model=ProductDeleteResponse)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    delete_product_service(db, product_id)
    return ProductDeleteResponse(
        product_id=product_id,
        message="Product deleted successfully",
    )
