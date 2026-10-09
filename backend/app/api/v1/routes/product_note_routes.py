from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.models.user import UserTable
from app.schemas.product_note_schema import ProductNoteCreate, ProductNoteResponse, ProductNoteWithAdmin
from app.services.product_note_service import ProductNoteService
from typing import List

router = APIRouter(prefix="/products/{product_id}/notes", tags=["product-notes"])

@router.post("", response_model=ProductNoteResponse, status_code=status.HTTP_201_CREATED)
def create_product_note(
    product_id: str,
    note_data: ProductNoteCreate,
    current_user: UserTable = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a note for a product (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create notes"
        )
    
    return ProductNoteService.create_note(
        db=db,
        product_id=product_id,
        admin_id=current_user.user_id,
        note_text=note_data.note_text
    )

@router.get("", response_model=List[ProductNoteWithAdmin])
def get_product_notes(
    product_id: str,
    current_user: UserTable = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all notes for a product (visible to all authenticated users)"""
    notes = ProductNoteService.get_product_notes(db=db, product_id=product_id)
    return notes

@router.patch("/{note_id}", response_model=ProductNoteResponse)
def update_product_note(
    product_id: str,
    note_id: str,
    note_data: ProductNoteCreate,
    current_user: UserTable = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a note (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update notes"
        )
    
    updated_note = ProductNoteService.update_note(
        db=db,
        note_id=note_id,
        note_text=note_data.note_text
    )
    
    if not updated_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    return updated_note

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_note(
    product_id: str,
    note_id: str,
    current_user: UserTable = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a note (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete notes"
        )
    
    if not ProductNoteService.delete_note(db=db, note_id=note_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
