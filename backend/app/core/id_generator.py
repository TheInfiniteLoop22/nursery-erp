from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.user import UserTable
from app.models.order_table import OrderTable
from uuid import uuid4
import re


def generate_uuid() -> str:
    return str(uuid4())

def generate_user_id(db: Session, role: str) -> str:
    """
    Generates a sequential user ID based on role.
    admin -> admin_001
    employee -> emp_001
    nursery -> nur_001
    """
    role_prefix_map = {
        "admin": "admin_",
        "employee": "emp_",
        "nursery": "nur_",
        "head_installation": "hins_",
        "head_maintenance": "hmnt_",
    }
    prefix = role_prefix_map.get(role, "usr_")
    
    # Find all IDs with this prefix
    user_ids = [
        row[0] for row in db.query(UserTable.user_id)
        .filter(UserTable.user_id.like(f"{prefix}%"))
        .all()
    ]
    
    # Filter to standard sequential format (prefix followed by digits)
    pattern = re.compile(rf"^{prefix}(\d+)$")
    nums = []
    for uid in user_ids:
        m = pattern.match(uid)
        if m:
            nums.append(int(m.group(1)))
            
    if not nums:
        return f"{prefix}001"
        
    next_num = max(nums) + 1
    return f"{prefix}{next_num:03d}"

def generate_order_id(db: Session) -> str:
    """
    Generates a sequential order ID.
    ord_001
    """
    prefix = "ord_"
    
    order_ids = [
        row[0] for row in db.query(OrderTable.order_id)
        .filter(OrderTable.order_id.like(f"{prefix}%"))
        .all()
    ]
    
    pattern = re.compile(rf"^{prefix}(\d+)$")
    nums = []
    for oid in order_ids:
        m = pattern.match(oid)
        if m:
            nums.append(int(m.group(1)))
            
    if not nums:
        return f"{prefix}001"
        
    next_num = max(nums) + 1
    return f"{prefix}{next_num:03d}"
