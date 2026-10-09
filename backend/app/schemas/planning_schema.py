from decimal import Decimal
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, condecimal, field_validator, model_validator

PlanType = Literal["MAINTENANCE", "INSTALL"]
PlanStatus = Literal["DRAFT", "SCHEDULED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "COMPLETED"]
CostType = Literal["EQUIPMENT", "GREEN_GOODS", "HARD_GOODS"]

MAINTENANCE_CATEGORIES = {
    "fall_spring_cleanup",
    "bark",
    "pruning",
    "weeding_plant_care",
    "planting",
    "fertilization",
    "mowing",
    "spraying",
    "waterfall_maintenance",
    "irrigation_watering",
    "replace_misc",
    "load_unload",
    "travel_time",
}

INSTALL_CATEGORIES = {
    "site_grading",
    "drain_tile",
    "boulder_install",
    "edging_install",
    "bed_prep",
    "plant_install",
    "tree_install",
    "stone_weed_barrier",
    "bark_mulch",
    "blue_stone_brick",
    "lawn_prep",
    "waterfall_install",
    "watering",
    "cleanup",
    "pickup_material",
    "lighting",
    "replace_misc",
    "travel_time",
    "load_unload",
}

ALL_PLANNING_CATEGORIES = MAINTENANCE_CATEGORIES | INSTALL_CATEGORIES


class PlanningJobCreate(BaseModel):
    plan_type: PlanType
    job_name: str = Field(..., min_length=2, max_length=200)
    location: Optional[str] = Field(default=None, max_length=255)
    work_order_id: Optional[str] = None
    event_id: Optional[str] = None
    job_date: str = Field(..., min_length=10, max_length=10)
    time_in: Optional[str] = Field(default=None, max_length=20)
    time_out: Optional[str] = Field(default=None, max_length=20)
    prepared_by: Optional[str] = None
    billable: bool = True
    create_calendar_event: bool = False
    notes: Optional[str] = None

    @field_validator("job_date")
    @classmethod
    def validate_job_date(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("job_date must use YYYY-MM-DD format") from exc
        return value


class PlanningJobUpdate(BaseModel):
    plan_type: Optional[PlanType] = None
    status: Optional[PlanStatus] = None
    job_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    location: Optional[str] = Field(default=None, max_length=255)
    work_order_id: Optional[str] = None
    event_id: Optional[str] = None
    job_date: Optional[str] = Field(default=None, min_length=10, max_length=10)
    time_in: Optional[str] = Field(default=None, max_length=20)
    time_out: Optional[str] = Field(default=None, max_length=20)
    prepared_by: Optional[str] = None
    billable: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("job_date")
    @classmethod
    def validate_job_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("job_date must use YYYY-MM-DD format") from exc
        return value

    @model_validator(mode="after")
    def require_one_field(self):
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("Provide at least one field to update")
        return self


class PlanningLaborEntryCreate(BaseModel):
    employee_id: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=80)
    planned_hours: condecimal(ge=0, max_digits=8, decimal_places=2) = Decimal("0")
    actual_hours: condecimal(ge=0, max_digits=8, decimal_places=2) = Decimal("0")
    hourly_rate: condecimal(ge=0, max_digits=10, decimal_places=2) = Decimal("0")
    notes: Optional[str] = None


class PlanningLaborEntryUpdate(BaseModel):
    employee_id: Optional[str] = None
    category: Optional[str] = Field(default=None, min_length=1, max_length=80)
    planned_hours: Optional[condecimal(ge=0, max_digits=8, decimal_places=2)] = None
    actual_hours: Optional[condecimal(ge=0, max_digits=8, decimal_places=2)] = None
    hourly_rate: Optional[condecimal(ge=0, max_digits=10, decimal_places=2)] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def require_one_field(self):
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("Provide at least one field to update")
        return self


class PlanningLaborBulkEntry(BaseModel):
    labor_entry_id: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=80)
    planned_hours: condecimal(ge=0, max_digits=8, decimal_places=2) = Decimal("0")
    actual_hours: condecimal(ge=0, max_digits=8, decimal_places=2) = Decimal("0")
    notes: Optional[str] = None


class PlanningLaborBulkSaveRequest(BaseModel):
    employee_id: str = Field(..., min_length=1)
    entries: list[PlanningLaborBulkEntry]



class PlanningCostEntryCreate(BaseModel):
    cost_type: CostType
    description: str = Field(..., min_length=1, max_length=255)
    quantity: condecimal(ge=0, max_digits=10, decimal_places=2) = Decimal("0")
    hours: Optional[condecimal(ge=0, max_digits=8, decimal_places=2)] = None
    unit_cost: condecimal(ge=0, max_digits=12, decimal_places=2) = Decimal("0")
    supplier: Optional[str] = Field(default=None, max_length=200)
    planned_total: Optional[condecimal(ge=0, max_digits=14, decimal_places=2)] = None
    actual_total: Optional[condecimal(ge=0, max_digits=14, decimal_places=2)] = None
    notes: Optional[str] = None


class PlanningCostEntryUpdate(BaseModel):
    cost_type: Optional[CostType] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    quantity: Optional[condecimal(ge=0, max_digits=10, decimal_places=2)] = None
    hours: Optional[condecimal(ge=0, max_digits=8, decimal_places=2)] = None
    unit_cost: Optional[condecimal(ge=0, max_digits=12, decimal_places=2)] = None
    supplier: Optional[str] = Field(default=None, max_length=200)
    planned_total: Optional[condecimal(ge=0, max_digits=14, decimal_places=2)] = None
    actual_total: Optional[condecimal(ge=0, max_digits=14, decimal_places=2)] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def require_one_field(self):
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("Provide at least one field to update")
        return self


class PlanningLaborEntryResponse(BaseModel):
    labor_entry_id: str
    plan_id: str
    employee_id: str
    employee_username: Optional[str] = None
    category: str
    planned_hours: str
    actual_hours: str
    hourly_rate: str
    planned_labor_total: str
    actual_labor_total: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class PlanningCostEntryResponse(BaseModel):
    cost_entry_id: str
    plan_id: str
    cost_type: str
    description: str
    quantity: str
    hours: Optional[str] = None
    unit_cost: str
    supplier: Optional[str] = None
    planned_total: str
    actual_total: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class PlanningTotals(BaseModel):
    planned_hours: str
    actual_hours: str
    planned_labor_total: str
    actual_labor_total: str
    planned_cost_total: str
    actual_cost_total: str
    planned_grand_total: str
    actual_grand_total: str


class PlanningJobResponse(BaseModel):
    plan_id: str
    plan_type: str
    status: str
    job_name: str
    location: Optional[str] = None
    work_order_id: Optional[str] = None
    client_name: Optional[str] = None
    event_id: Optional[str] = None
    job_date: str
    time_in: Optional[str] = None
    time_out: Optional[str] = None
    prepared_by: Optional[str] = None
    billable: bool
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str
    totals: PlanningTotals
    labor_entries: list[PlanningLaborEntryResponse] = []
    cost_entries: list[PlanningCostEntryResponse] = []


class PlanningJobListResponse(BaseModel):
    items: list[PlanningJobResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
