import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.nursery import Nursery
from app.models.product_submission import ProductSubmission
from app.models.user import UserTable
from app.models.zone_configuration import ZoneConfiguration
from app.schemas.product_submission_schema import ProductSubmissionCreateRequest
from app.services.notification_service import (
    create_notification,
    update_notification_for_review_status,
)
from app.services.product_service import add_product_service
from app.schemas.product_schema import ProductCreateRequest
from app.utils.size_formatter import (
    build_product_size_label,
    extract_view_dimensions,
    section_is_shrubs,
    section_uses_gallon_pot_sizing,
    shrubs_has_gallons_or_height,
)
from app.utils.zone_formatter import generate_subzone_codes, normalize_subzone_code

PRINTED_BARCODE_STATUSES = frozenset({"PRINTED_BY_ADMIN", "PRINTED_BY_NURSERY"})


def pending_barcode_product_ids_query(db: Session):
    return (
        db.query(ProductSubmission.approved_product_id)
        .filter(
            ProductSubmission.status == "APPROVED",
            ProductSubmission.approved_product_id.isnot(None),
            ~ProductSubmission.barcode_status.in_(list(PRINTED_BARCODE_STATUSES)),
        )
    )


def is_product_live(db: Session, product_id: str) -> bool:
    pending = (
        pending_barcode_product_ids_query(db)
        .filter(ProductSubmission.approved_product_id == product_id)
        .first()
    )
    return pending is None


def create_product_submission(
    db: Session,
    payload: ProductSubmissionCreateRequest,
    *,
    requester: UserTable,
) -> ProductSubmission:
    nursery = db.query(Nursery).filter(Nursery.nursery_id == payload.nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    zone = db.query(ZoneConfiguration).filter(ZoneConfiguration.zone_number == payload.zones).first()
    if not zone:
        raise HTTPException(status_code=400, detail=f"Zone {payload.zones} is not configured")

    normalized_gallons = payload.gallons.strip() if payload.gallons and payload.gallons.strip() else None
    normalized_subzone = normalize_subzone_code(payload.subzone)
    valid_subzones = generate_subzone_codes(zone.subzone_count)
    if valid_subzones:
        if not normalized_subzone:
            raise HTTPException(status_code=400, detail=f"Subzone is required for zone {payload.zones}")
        if normalized_subzone not in valid_subzones:
            raise HTTPException(status_code=400, detail=f"Invalid subzone {payload.zones}{normalized_subzone}")
    else:
        normalized_subzone = None

    if section_uses_gallon_pot_sizing(str(payload.section)):
        sec = str(payload.section)
        if section_is_shrubs(sec):
            if not shrubs_has_gallons_or_height(normalized_gallons, payload.height_feet):
                raise HTTPException(
                    status_code=400,
                    detail="Shrubs require either pot size (gallons) or height (or both)",
                )
        elif normalized_gallons is None:
            raise HTTPException(status_code=400, detail="Gallons is required for perennials")
        normalized_size = (
            payload.size.strip()
            if payload.size and payload.size.strip()
            else build_product_size_label(
                str(payload.section),
                payload.height_feet,
                payload.caliper_inches,
                normalized_gallons,
            )
        )
    else:
        normalized_size = payload.size.strip() if payload.size and payload.size.strip() else build_product_size_label(
            payload.section,
            payload.height_feet,
            payload.caliper_inches,
        )

    submission = ProductSubmission(
        submission_id=f"sub_{uuid.uuid4().hex[:16]}",
        employee_id=requester.user_id,
        nursery_id=payload.nursery_id,
        item_name=payload.item_name.strip(),
        section=payload.section,
        zones=payload.zones,
        subzone=normalized_subzone,
        size=normalized_size,
        gallons=normalized_gallons if section_uses_gallon_pot_sizing(str(payload.section)) else None,
        inventory_quantity=payload.inventory_quantity,
        image_url=str(payload.image_url) if payload.image_url else None,
        status="PENDING",
    )

    db.add(submission)
    db.flush()

    create_notification(
        db,
        type="product_submission",
        title="Product submission pending",
        message=(
            f"{requester.user_username} submitted {submission.item_name} ({submission.size}) "
            f"for review and pricing approval."
        ),
        actor_user_id=requester.user_id,
        reference_id=submission.submission_id,
    )

    db.commit()
    db.refresh(submission)
    return submission


def list_pending_product_submissions(db: Session) -> list[ProductSubmission]:
    return (
        db.query(ProductSubmission)
        .filter(ProductSubmission.status == "PENDING")
        .order_by(desc(ProductSubmission.created_at))
        .all()
    )


def list_product_submissions_for_requester(db: Session, employee_id: str) -> list[ProductSubmission]:
    return (
        db.query(ProductSubmission)
        .filter(ProductSubmission.employee_id == employee_id)
        .order_by(desc(ProductSubmission.created_at))
        .all()
    )


def list_pending_product_submissions_paginated(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
) -> tuple[list[ProductSubmission], int]:
    query = db.query(ProductSubmission).filter(ProductSubmission.status == "PENDING")
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (ProductSubmission.item_name.ilike(term))
            | (ProductSubmission.submission_id.ilike(term))
            | (ProductSubmission.size.ilike(term))
            | (ProductSubmission.nursery_id.ilike(term))
        )
    total = query.with_entities(func.count(ProductSubmission.submission_id)).scalar() or 0
    offset = (page - 1) * page_size
    items = (
        query
        .order_by(desc(ProductSubmission.created_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return items, int(total)


def list_product_submissions_for_requester_paginated(
    db: Session,
    employee_id: str,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: str | None = None,
) -> tuple[list[ProductSubmission], int]:
    query = db.query(ProductSubmission).filter(ProductSubmission.employee_id == employee_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (ProductSubmission.item_name.ilike(term))
            | (ProductSubmission.submission_id.ilike(term))
            | (ProductSubmission.size.ilike(term))
        )

    if status and status.strip() and status.strip().lower() != "all":
        query = query.filter(func.lower(ProductSubmission.status) == status.strip().lower())

    total = query.with_entities(func.count(ProductSubmission.submission_id)).scalar() or 0
    offset = (page - 1) * page_size
    items = (
        query.order_by(desc(ProductSubmission.created_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return items, int(total)


def get_product_submission(db: Session, submission_id: str) -> ProductSubmission:
    submission = db.query(ProductSubmission).filter(ProductSubmission.submission_id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


def approve_product_submission(
    db: Session,
    submission: ProductSubmission,
    *,
    reviewer: UserTable,
    base_price_per_unit,
    rate_percentage,
    item_name: str | None = None,
):
    if submission.status != "PENDING":
        raise HTTPException(status_code=409, detail="Submission has already been reviewed")

    if item_name and item_name.strip():
        submission.item_name = item_name.strip()

    view_h, view_c = extract_view_dimensions(str(submission.section), submission.size)
    product_request = ProductCreateRequest(
        nursery_id=submission.nursery_id,
        item_name=submission.item_name,
        section=submission.section,
        zones=submission.zones,
        subzone=submission.subzone,
        size=submission.size,
        height_feet=view_h,
        caliper_inches=view_c,
        gallons=submission.gallons,
        inventory_quantity=submission.inventory_quantity,
        ordered_quantity=0,
        low_stock_threshold=10,
        base_price_per_unit=base_price_per_unit,
        rate_percentage=rate_percentage,
        image_url=submission.image_url,
    )

    product = add_product_service(
        db,
        product_request,
        actor_role="admin",
        merge_existing_inventory=False,
    )

    submission.status = "APPROVED"
    submission.approved_product_id = product.product_id
    submission.reviewed_by = reviewer.user_id
    update_notification_for_review_status(
        db,
        reference_id=submission.submission_id,
        reviewer_name=reviewer.user_username,
        item_name=submission.item_name,
    )

    db.commit()
    db.refresh(submission)
    return product


def list_pending_barcode_submissions_paginated(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    nursery_ids: list[str] | None = None,
    sections: list[str] | None = None,
) -> tuple[list[ProductSubmission], int]:
    query = db.query(ProductSubmission).filter(
        ProductSubmission.status == "APPROVED",
        ProductSubmission.approved_product_id.isnot(None),
        ~ProductSubmission.barcode_status.in_(list(PRINTED_BARCODE_STATUSES)),
    )
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (ProductSubmission.item_name.ilike(term))
            | (ProductSubmission.submission_id.ilike(term))
            | (ProductSubmission.approved_product_id.ilike(term))
            | (ProductSubmission.size.ilike(term))
            | (ProductSubmission.nursery_id.ilike(term))
        )
    if nursery_ids:
        query = query.filter(ProductSubmission.nursery_id.in_(nursery_ids))
    normalized_sections = {
        section.strip().lower()
        for section in (sections or [])
        if section and section.strip()
    }
    if normalized_sections:
        query = query.filter(func.lower(ProductSubmission.section).in_(normalized_sections))
    total = query.with_entities(func.count(ProductSubmission.submission_id)).scalar() or 0
    offset = (page - 1) * page_size
    items = (
        query.order_by(desc(ProductSubmission.updated_at))
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return items, int(total)


def update_submission_barcode_status(
    db: Session,
    submission: ProductSubmission,
    *,
    barcode_status: str,
    actor_user_id: str,
    actor_role: str,
) -> ProductSubmission:
    if submission.status != "APPROVED":
        raise HTTPException(status_code=409, detail="Barcode status can be updated only after approval")

    if submission.barcode_status in PRINTED_BARCODE_STATUSES:
        raise HTTPException(status_code=409, detail="Barcode has already been printed")

    if actor_role == "nursery":
        if barcode_status != "PRINTED_BY_NURSERY":
            raise HTTPException(status_code=403, detail="Nursery can only mark barcode as printed")
        if submission.barcode_status != "PENDING_NURSERY_PRINT":
            raise HTTPException(
                status_code=403,
                detail="Nursery can print only when admin assigned printing to nursery",
            )
    elif actor_role == "admin":
        if barcode_status == "PRINTED_BY_ADMIN":
            if submission.barcode_status not in ("PENDING_NURSERY_PRINT", "NOT_SET"):
                raise HTTPException(status_code=409, detail="Admin cannot print barcode for this submission")
        elif barcode_status == "PENDING_NURSERY_PRINT":
            if submission.barcode_status != "NOT_SET":
                raise HTTPException(status_code=409, detail="Barcode assignment already set for this submission")
        elif barcode_status == "PRINTED_BY_NURSERY":
            raise HTTPException(status_code=403, detail="Admin cannot mark barcode as printed by nursery")
        else:
            raise HTTPException(status_code=400, detail="Invalid barcode status for admin")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    submission.barcode_status = barcode_status
    if barcode_status in ("PRINTED_BY_ADMIN", "PRINTED_BY_NURSERY"):
        submission.barcode_printed_at = func.now()
        submission.barcode_printed_by = actor_user_id
    else:
        submission.barcode_printed_at = None
        submission.barcode_printed_by = None

    db.commit()
    db.refresh(submission)
    return submission
