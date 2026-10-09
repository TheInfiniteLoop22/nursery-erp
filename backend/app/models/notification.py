from sqlalchemy import Column, String, TIMESTAMP, text, Boolean
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notification"

    notification_id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    actor_user_id = Column(String, nullable=True)
    reference_id = Column(String, nullable=True)
    is_read = Column(Boolean, nullable=False, server_default=text("false"))

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()")
    )
