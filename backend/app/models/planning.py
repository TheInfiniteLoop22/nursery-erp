import enum
from sqlalchemy import Boolean, CheckConstraint, Column, Enum, ForeignKey, Numeric, String, TIMESTAMP, Text, text
from app.core.database import Base


class PlanningJobType(str, enum.Enum):
    MAINTENANCE = "MAINTENANCE"
    INSTALL = "INSTALL"


class PlanningJobStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"


class PlanningCostType(str, enum.Enum):
    EQUIPMENT = "EQUIPMENT"
    GREEN_GOODS = "GREEN_GOODS"
    HARD_GOODS = "HARD_GOODS"


class PlanningJob(Base):
    __tablename__ = "planning_job"

    plan_id = Column(String, primary_key=True, index=True)
    plan_type = Column(
        Enum(PlanningJobType, name="planning_job_type_enum", create_type=True, metadata=Base.metadata),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(PlanningJobStatus, name="planning_job_status_enum", create_type=True, metadata=Base.metadata),
        nullable=False,
        server_default=PlanningJobStatus.DRAFT.value,
        index=True,
    )

    job_name = Column(String(200), nullable=False, index=True)
    location = Column(String(255), nullable=True)
    work_order_id = Column(String, ForeignKey("order_table.order_id", ondelete="SET NULL"), nullable=True, index=True)
    event_id = Column(String, ForeignKey("event_table.event_id", ondelete="SET NULL"), nullable=True, index=True)

    job_date = Column(String(10), nullable=False, index=True)
    time_in = Column(String(20), nullable=True)
    time_out = Column(String(20), nullable=True)
    prepared_by = Column(String, ForeignKey("user_table.user_id", ondelete="SET NULL"), nullable=True, index=True)
    billable = Column(Boolean, nullable=False, server_default=text("true"))
    notes = Column(Text, nullable=True)

    created_by = Column(String, ForeignKey("user_table.user_id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))


class PlanningLaborEntry(Base):
    __tablename__ = "planning_labor_entry"

    labor_entry_id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("planning_job.plan_id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String, ForeignKey("user_table.user_id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(80), nullable=False, index=True)
    planned_hours = Column(Numeric(8, 2), nullable=False, server_default="0")
    actual_hours = Column(Numeric(8, 2), nullable=False, server_default="0")
    hourly_rate = Column(Numeric(10, 2), nullable=False, server_default="0")
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))

    __table_args__ = (
        CheckConstraint("planned_hours >= 0", name="planning_labor_planned_hours_nonnegative"),
        CheckConstraint("actual_hours >= 0", name="planning_labor_actual_hours_nonnegative"),
        CheckConstraint("hourly_rate >= 0", name="planning_labor_hourly_rate_nonnegative"),
    )


class PlanningCostEntry(Base):
    __tablename__ = "planning_cost_entry"

    cost_entry_id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("planning_job.plan_id", ondelete="CASCADE"), nullable=False, index=True)
    cost_type = Column(
        Enum(PlanningCostType, name="planning_cost_type_enum", create_type=True, metadata=Base.metadata),
        nullable=False,
        index=True,
    )
    description = Column(String(255), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, server_default="0")
    hours = Column(Numeric(8, 2), nullable=True)
    unit_cost = Column(Numeric(12, 2), nullable=False, server_default="0")
    supplier = Column(String(200), nullable=True)
    planned_total = Column(Numeric(14, 2), nullable=False, server_default="0")
    actual_total = Column(Numeric(14, 2), nullable=False, server_default="0")
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="planning_cost_quantity_nonnegative"),
        CheckConstraint("hours IS NULL OR hours >= 0", name="planning_cost_hours_nonnegative"),
        CheckConstraint("unit_cost >= 0", name="planning_cost_unit_cost_nonnegative"),
        CheckConstraint("planned_total >= 0", name="planning_cost_planned_total_nonnegative"),
        CheckConstraint("actual_total >= 0", name="planning_cost_actual_total_nonnegative"),
    )
