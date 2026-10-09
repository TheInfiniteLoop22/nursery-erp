from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import UserTable
from app.schemas.nursery_schema import (
    NurseryActionResponse,
    NurseryCreateRequest,
    NurseryDetailView,
    NurseryListSummaryResponse,
    NurserySummaryView,
    NurseryUpdateRequest,
    PaginatedNurseryListResponse,
)
from app.services.nursery_service import (
    create_nursery,
    delete_nursery,
    get_nursery_detail,
    get_nursery_list_summary,
    list_nursery_summaries_paginated,
    update_nursery,
)

router = APIRouter()

def _require_nursery_manager(current_user: UserTable) -> UserTable:
    if current_user.role not in ("admin", "nursery"):
        raise HTTPException(status_code=403, detail="Admin or nursery access required")
    return current_user


@router.get("/summary", response_model=NurseryListSummaryResponse)
def get_nurseries_summary(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    search: str | None = None,
):
    return get_nursery_list_summary(db, search=search)


@router.get("/all", response_model=PaginatedNurseryListResponse)
def show_all_nurseries(
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    items, total = list_nursery_summaries_paginated(
        db,
        page=page,
        page_size=page_size,
        search=search,
    )
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": int(total_pages),
    }


@router.get("/{nursery_id}", response_model=NurseryDetailView)
def get_nursery_by_id(
    nursery_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    return get_nursery_detail(db, nursery_id)


@router.post("/add", response_model=NurseryActionResponse)
def add_nursery(
    payload: NurseryCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_nursery_manager(current_user)
    nursery = create_nursery(db, payload)
    return NurseryActionResponse(nursery_id=nursery.nursery_id, message="Nursery added successfully")


@router.patch("/{nursery_id}", response_model=NurseryActionResponse)
def edit_nursery(
    nursery_id: str,
    payload: NurseryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_nursery_manager(current_user)
    nursery = update_nursery(db, nursery_id, payload)
    return NurseryActionResponse(nursery_id=nursery.nursery_id, message="Nursery updated successfully")


@router.delete("/{nursery_id}", response_model=NurseryActionResponse)
def remove_nursery(
    nursery_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_nursery_manager(current_user)
    delete_nursery(db, nursery_id)
    return NurseryActionResponse(nursery_id=nursery_id, message="Nursery deleted successfully")