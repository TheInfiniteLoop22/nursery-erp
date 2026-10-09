from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import UserTable
from app.models.zone_configuration import ZoneConfiguration
from app.schemas.zone_schema import ZoneDeleteResponse, ZoneUpsertRequest, ZoneView, ZoneSubzoneView
from app.utils.zone_formatter import build_zone_label, generate_subzone_codes

router = APIRouter()


def _zone_to_view(zone: ZoneConfiguration) -> ZoneView:
    codes = generate_subzone_codes(zone.subzone_count)
    return ZoneView(
        zone_number=zone.zone_number,
        subzone_count=zone.subzone_count,
        subzones=[ZoneSubzoneView(code=code, label=build_zone_label(zone.zone_number, code)) for code in codes],
    )


@router.get("", response_model=list[ZoneView])
def list_zones(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    zones = db.query(ZoneConfiguration).order_by(ZoneConfiguration.zone_number.asc()).all()
    return [_zone_to_view(zone) for zone in zones]


@router.post("", response_model=ZoneView)
def create_zone(
    payload: ZoneUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = db.query(ZoneConfiguration).filter(ZoneConfiguration.zone_number == payload.zone_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Zone already exists")

    zone = ZoneConfiguration(zone_number=payload.zone_number, subzone_count=payload.subzone_count)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _zone_to_view(zone)


@router.patch("/{zone_number}", response_model=ZoneView)
def update_zone(
    zone_number: int,
    payload: ZoneUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    zone = db.query(ZoneConfiguration).filter(ZoneConfiguration.zone_number == zone_number).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone.subzone_count = payload.subzone_count
    db.commit()
    db.refresh(zone)
    return _zone_to_view(zone)


@router.delete("/{zone_number}", response_model=ZoneDeleteResponse)
def delete_zone(
    zone_number: int,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    zone = db.query(ZoneConfiguration).filter(ZoneConfiguration.zone_number == zone_number).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    db.delete(zone)
    db.commit()
    return ZoneDeleteResponse(zone_number=zone_number, message="Zone deleted successfully")