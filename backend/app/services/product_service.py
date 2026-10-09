from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.nursery import Nursery
from app.models.zone_configuration import ZoneConfiguration
from app.schemas.product_schema import ProductCreateRequest
from app.utils.product_id_generator import generate_product_id_8digit
from app.utils.size_formatter import (
    build_product_size_label,
    section_is_shrubs,
    section_uses_gallon_pot_sizing,
    shrubs_has_gallons_or_height,
)
from app.utils.zone_formatter import build_zone_label, generate_subzone_codes, normalize_subzone_code

EMPLOYEE_FIXED_RATE_MULTIPLIER = "2.25"


def _load_zone_configuration(db: Session, zone_number: int) -> ZoneConfiguration:
    zone = db.query(ZoneConfiguration).filter(ZoneConfiguration.zone_number == zone_number).first()
    if not zone:
        raise HTTPException(status_code=400, detail=f"Zone {zone_number} is not configured")
    return zone


def _normalize_zone_values(db: Session, zone_number: int, subzone: str | None) -> tuple[int, str | None]:
    zone = _load_zone_configuration(db, zone_number)
    normalized_subzone = normalize_subzone_code(subzone)
    valid_subzones = generate_subzone_codes(zone.subzone_count)

    if valid_subzones:
        if not normalized_subzone:
          raise HTTPException(status_code=400, detail=f"Subzone is required for zone {zone_number}")
        if normalized_subzone not in valid_subzones:
            raise HTTPException(status_code=400, detail=f"Invalid subzone {build_zone_label(zone_number, normalized_subzone)}")
    else:
        normalized_subzone = None

    return zone.zone_number, normalized_subzone


def add_product_service(
    db: Session,
    payload: ProductCreateRequest,
    *,
    actor_role: str,
    merge_existing_inventory: bool = False,
):
    nursery = db.query(Nursery).filter(Nursery.nursery_id == payload.nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    zone_number, subzone = _normalize_zone_values(db, payload.zones, payload.subzone)

    section = payload.section.strip().lower()
    normalized_gallons = payload.gallons.strip() if payload.gallons and payload.gallons.strip() else None
    if section_uses_gallon_pot_sizing(section):
        if section_is_shrubs(section):
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
                section,
                payload.height_feet,
                payload.caliper_inches,
                normalized_gallons,
            )
        )
    else:
        normalized_size = payload.size.strip() if payload.size and payload.size.strip() else build_product_size_label(
            section,
            payload.height_feet,
            payload.caliper_inches,
        )

    product_id = generate_product_id_8digit(
        payload.nursery_id,
        normalized_size,
        payload.item_name,
        zone_number=zone_number,
        subzone=subzone,
    )

    existing = db.query(Product).filter(Product.product_id == product_id).first()
    if existing:
        if merge_existing_inventory:
            existing.inventory_quantity = existing.inventory_quantity + payload.inventory_quantity
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(
            status_code=409,
            detail=f"Product already exists with product_id={product_id}"
        )

    effective_rate = payload.rate_percentage
    if actor_role == "employee":
        effective_rate = Decimal(EMPLOYEE_FIXED_RATE_MULTIPLIER)

    new_product = Product(
        product_id=product_id,
        nursery_id=payload.nursery_id,
        item_name=payload.item_name.strip(),
        section=section,
        zones=zone_number,
        subzone=subzone,
        size=normalized_size,
        gallons=normalized_gallons if section_uses_gallon_pot_sizing(section) else None,
        inventory_quantity=payload.inventory_quantity,
        ordered_quantity=payload.ordered_quantity,
        base_price_per_unit=payload.base_price_per_unit,
        rate_percentage=effective_rate,
        image_url=str(payload.image_url) if payload.image_url else None
    )

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return new_product


def add_stock_service(db: Session, product_id: str, quantity: int) -> Product:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.inventory_quantity = product.inventory_quantity + quantity
    db.commit()
    db.refresh(product)
    return product


def update_product_service(db: Session, product_id: str, payload) -> Product:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    nursery = db.query(Nursery).filter(Nursery.nursery_id == payload.nursery_id).first()
    if not nursery:
        raise HTTPException(status_code=404, detail="Nursery not found")

    zone_number, subzone = _normalize_zone_values(db, payload.zones, payload.subzone)

    section = payload.section.strip().lower()
    normalized_gallons = payload.gallons.strip() if payload.gallons and payload.gallons.strip() else None
    if section_uses_gallon_pot_sizing(section):
        if section_is_shrubs(section):
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
                section,
                payload.height_feet,
                payload.caliper_inches,
                normalized_gallons,
            )
        )
    else:
        normalized_size = payload.size.strip() if payload.size and payload.size.strip() else build_product_size_label(
            section,
            payload.height_feet,
            payload.caliper_inches,
        )

    product.nursery_id = payload.nursery_id
    product.item_name = payload.item_name.strip()
    product.section = section
    product.zones = zone_number
    product.subzone = subzone
    product.size = normalized_size
    product.gallons = normalized_gallons if section_uses_gallon_pot_sizing(section) else None
    product.inventory_quantity = payload.inventory_quantity
    product.low_stock_threshold = payload.low_stock_threshold
    product.base_price_per_unit = payload.base_price_per_unit
    product.rate_percentage = payload.rate_percentage
    product.image_url = str(payload.image_url) if payload.image_url else None

    db.commit()
    db.refresh(product)
    return product


def delete_product_service(db: Session, product_id: str) -> None:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
