from pydantic import BaseModel, Field
from typing import Optional

class EmployeeCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field(default="employee")
    hourly_rate: float = Field(default=0, ge=0)
    hourly_rate_multiplier: float = Field(default=1.0, ge=0)

class EmployeeCreateResponse(BaseModel):
    employee_id: str
    username: str
    role: str
    message: str

class EmployeeResponse(BaseModel):
    employee_id: str
    username: str
    role: str
    hourly_rate: str
    hourly_rate_multiplier: str
    created_at: str
    items_scanned: int
    orders_completed: int
    status: str
    
    class Config:
        from_attributes = True

class EmployeeUpdateRequest(BaseModel):
    hourly_rate: Optional[float] = Field(default=None, ge=0)
    hourly_rate_multiplier: Optional[float] = Field(default=None, ge=0)
    role: Optional[str] = None
