from sqlalchemy.orm import Session
from app.models.product_note import ProductNote
from app.models.user import UserTable
from app.schemas.product_note_schema import ProductNoteCreate, ProductNoteResponse, ProductNoteWithAdmin
from app.core.id_generator import generate_uuid
from typing import List, Optional

class ProductNoteService:
    
    @staticmethod
    def create_note(
        db: Session,
        product_id: str,
        admin_id: str,
        note_text: str
    ) -> ProductNoteResponse:
        """Create a new note for a product"""
        new_note = ProductNote(
            note_id=generate_uuid(),
            product_id=product_id,
            admin_id=admin_id,
            note_text=note_text
        )
        db.add(new_note)
        db.commit()
        db.refresh(new_note)
        return ProductNoteResponse.from_orm(new_note)
    
    @staticmethod
    def get_product_notes(db: Session, product_id: str) -> List[ProductNoteWithAdmin]:
        """Get all notes for a product with admin information"""
        notes = db.query(ProductNote).filter(
            ProductNote.product_id == product_id
        ).order_by(ProductNote.created_at.desc()).all()
        
        result = []
        for note in notes:
            admin_name = None
            if note.admin_id:
                admin = db.query(UserTable).filter(
                    UserTable.user_id == note.admin_id
                ).first()
                admin_name = admin.user_username if admin else None
            
            result.append(ProductNoteWithAdmin(
                note_id=note.note_id,
                product_id=note.product_id,
                admin_id=note.admin_id,
                admin_name=admin_name,
                note_text=note.note_text,
                created_at=note.created_at,
                updated_at=note.updated_at
            ))
        
        return result
    
    @staticmethod
    def update_note(
        db: Session,
        note_id: str,
        note_text: str
    ) -> Optional[ProductNoteResponse]:
        """Update an existing note"""
        note = db.query(ProductNote).filter(
            ProductNote.note_id == note_id
        ).first()
        
        if not note:
            return None
        
        note.note_text = note_text
        db.commit()
        db.refresh(note)
        return ProductNoteResponse.from_orm(note)
    
    @staticmethod
    def delete_note(db: Session, note_id: str) -> bool:
        """Delete a note"""
        note = db.query(ProductNote).filter(
            ProductNote.note_id == note_id
        ).first()
        
        if not note:
            return False
        
        db.delete(note)
        db.commit()
        return True
