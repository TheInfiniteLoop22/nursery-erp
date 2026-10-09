from sqlalchemy import Column, Integer

from app.core.database import Base


class ZoneConfiguration(Base):
    __tablename__ = "zone_configuration"

    zone_number = Column(Integer, primary_key=True, index=True)
    subzone_count = Column(Integer, nullable=False, default=0)