import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    type: str,
    title: str,
    message: str,
    actor_user_id: str | None = None,
    reference_id: str | None = None,
) -> Notification:
    notification = Notification(
        notification_id=f"ntf_{uuid.uuid4().hex[:16]}",
        type=type,
        title=title,
        message=message,
        actor_user_id=actor_user_id,
        reference_id=reference_id,
    )
    db.add(notification)
    db.flush()
    return notification


def mark_notification_as_read(db: Session, notification_id: str) -> Notification:
    notification = (
        db.query(Notification)
        .filter(Notification.notification_id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def update_notification_for_review_status(
    db: Session,
    *,
    reference_id: str,
    reviewer_name: str,
    item_name: str,
) -> None:
    notification = (
        db.query(Notification)
        .filter(Notification.reference_id == reference_id)
        .filter(Notification.type == "product_submission")
        .first()
    )

    if not notification:
        return

    notification.type = "product_submission_approved"
    notification.title = "Product submission approved"
    notification.message = f"{item_name} was approved by {reviewer_name}. Click to review the submission details."
    notification.is_read = False
    db.flush()
