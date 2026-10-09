import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.nursery import Nursery
from app.models.product import Product
from app.schemas.nursery_schema import (
    NurseryCreateRequest,
    NurseryUpdateRequest,
    NurserySummaryView,
    NurseryDetailView,
    NurseryProductView,
)
from app.utils.size_formatter import extract_view_dimensions


def _clean_optional_str(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _products_stats_by_nursery(db: Session, nursery_ids: list[str] | None = None) -> dict[str, dict]:
    query = db.query(
        Product.nursery_id,
        func.count(Product.product_id),
        func.coalesce(func.sum(Product.inventory_quantity), 0),
        func.coalesce(func.sum(Product.ordered_quantity), 0),
        func.array_agg(Product.item_name),
    ).group_by(Product.nursery_id)

    if nursery_ids is not None:
        if not nursery_ids:
            return {}
        query = query.filter(Product.nursery_id.in_(nursery_ids))

    return {
        nursery_id: {
            "count": int(count or 0),
            "inventory": int(inventory or 0),
            "ordered": int(ordered or 0),
            "featured": list(featured[:3]) if featured else [],
        }
        for nursery_id, count, inventory, ordered, featured in query.all()
    }


def _serialize_nursery_summary(nursery: Nursery, stats: dict) -> NurserySummaryView:
    return NurserySummaryView(
        nursery_id=nursery.nursery_id,
        nursery_name=nursery.nursery_name,
        contact_email=nursery.contact_email,
        contact_phone=nursery.contact_phone,
        products_count=int(stats.get("count", 0)),
        total_inventory=int(stats.get("inventory", 0)),
        total_ordered_quantity=int(stats.get("ordered", 0)),
        featured_products=list(stats.get("featured", [])),
    )


def build_nursery_list_query(db: Session, search: str | None = None):
    query = db.query(Nursery)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Nursery.nursery_name.ilike(term))
            | (Nursery.nursery_id.ilike(term))
            | (Nursery.contact_email.ilike(term))
            | (Nursery.contact_phone.ilike(term))
        )
    return query.order_by(Nursery.nursery_name.asc())


def list_nursery_summaries(db: Session) -> list[NurserySummaryView]:
    nurseries = build_nursery_list_query(db).all()
    products_by_nursery = _products_stats_by_nursery(db)

    summaries: list[NurserySummaryView] = []
    for nursery in nurseries:
        stats = products_by_nursery.get(
            nursery.nursery_id,
            {"count": 0, "inventory": 0, "ordered": 0, "featured": []},
        )
        summaries.append(_serialize_nursery_summary(nursery, stats))

    return summaries


def list_nursery_summaries_paginated(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
) -> tuple[list[NurserySummaryView], int]:
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    offset = (page - 1) * page_size

    query = build_nursery_list_query(db, search=search)
    total = query.count()
    nurseries = query.offset(offset).limit(page_size).all()
    nursery_ids = [nursery.nursery_id for nursery in nurseries]
    products_by_nursery = _products_stats_by_nursery(db, nursery_ids)

    items = [
        _serialize_nursery_summary(
            nursery,
            products_by_nursery.get(
                nursery.nursery_id,
                {"count": 0, "inventory": 0, "ordered": 0, "featured": []},
            ),
        )
        for nursery in nurseries
    ]
    return items, int(total)


def get_nursery_list_summary(db: Session, search: str | None = None) -> dict[str, int]:
    nursery_ids = [
        nursery_id
        for (nursery_id,) in build_nursery_list_query(db, search=search).with_entities(Nursery.nursery_id).all()
    ]

    if not nursery_ids:
        return {
            "total_vendors": 0,
            "total_products": 0,
            "total_inventory": 0,
            "total_ordered_quantity": 0,
        }

    row = (
        db.query(
            func.count(Product.product_id),
            func.coalesce(func.sum(Product.inventory_quantity), 0),
            func.coalesce(func.sum(Product.ordered_quantity), 0),
        )
        .filter(Product.nursery_id.in_(nursery_ids))
        .one()
    )

    return {
        "total_vendors": len(nursery_ids),
        "total_products": int(row[0] or 0),
        "total_inventory": int(row[1] or 0),
        "total_ordered_quantity": int(row[2] or 0),
    }


def get_nursery_detail(db: Session, nursery_id: str) -> NurseryDetailView:
    nursery = db.query(Nursery).filter(Nursery.nursery_id == nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    products = (
        db.query(Product)
        .filter(Product.nursery_id == nursery_id)
        .order_by(Product.item_name.asc())
        .all()
    )

    total_inventory = sum(product.inventory_quantity for product in products)
    total_ordered = sum(product.ordered_quantity for product in products)

    return NurseryDetailView(
        nursery_id=nursery.nursery_id,
        nursery_name=nursery.nursery_name,
        contact_email=nursery.contact_email,
        contact_phone=nursery.contact_phone,
        products_count=len(products),
        total_inventory=total_inventory,
        total_ordered_quantity=total_ordered,
        featured_products=[product.item_name for product in products[:3]],
        notes=nursery.notes,
        products=[
            NurseryProductView(
                product_id=product.product_id,
                item_name=product.item_name,
                size=product.size,
                height_feet=h,
                caliper_inches=c,
                inventory_quantity=product.inventory_quantity,
                ordered_quantity=product.ordered_quantity,
                image_url=product.image_url,
            )
            for product in products
            for h, c in [extract_view_dimensions(product.section, product.size)]
        ],
    )


def create_nursery(db: Session, payload: NurseryCreateRequest) -> Nursery:
    nursery_name = payload.nursery_name.strip()
    if not nursery_name:
        raise HTTPException(status_code=400, detail="Nursery name is required")

    existing = db.query(Nursery).filter(func.lower(Nursery.nursery_name) == nursery_name.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Nursery already exists")

    nursery = Nursery(
        nursery_id=f"nur_{uuid.uuid4().hex[:16]}",
        nursery_name=nursery_name,
        contact_email=_clean_optional_str(payload.contact_email),
        contact_phone=_clean_optional_str(payload.contact_phone),
        notes=_clean_optional_str(payload.notes),
    )
    db.add(nursery)
    db.commit()
    db.refresh(nursery)
    return nursery


def update_nursery(db: Session, nursery_id: str, payload: NurseryUpdateRequest) -> Nursery:
    nursery = db.query(Nursery).filter(Nursery.nursery_id == nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "nursery_name" in updates and updates["nursery_name"] is not None:
        nursery_name = str(updates["nursery_name"]).strip()
        if not nursery_name:
            raise HTTPException(status_code=400, detail="Nursery name is required")

        duplicate = (
            db.query(Nursery)
            .filter(func.lower(Nursery.nursery_name) == nursery_name.lower())
            .filter(Nursery.nursery_id != nursery_id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Nursery already exists")

        nursery.nursery_name = nursery_name

    if "contact_email" in updates:
        nursery.contact_email = _clean_optional_str(updates["contact_email"])
    if "contact_phone" in updates:
        nursery.contact_phone = _clean_optional_str(updates["contact_phone"])
    if "notes" in updates:
        raw = updates["notes"]
        if raw is None:
            nursery.notes = None
        else:
            nursery.notes = _clean_optional_str(str(raw))

    db.commit()
    db.refresh(nursery)
    return nursery


def delete_nursery(db: Session, nursery_id: str) -> None:
    nursery = db.query(Nursery).filter(Nursery.nursery_id == nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    db.delete(nursery)
    db.commit()