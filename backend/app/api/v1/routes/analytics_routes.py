from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from datetime import datetime, timedelta

from app.core.deps import get_db, require_admin, get_current_user
from app.models.order_table import OrderTable, OrderStatus
from app.models.ordered_products import OrderedProducts
from app.models.product import Product
from app.models.nursery import Nursery
from app.models.user import UserTable

router = APIRouter()

def _require_nursery_or_admin(current_user: UserTable) -> UserTable:
    if current_user.role not in ("admin", "nursery"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin or nursery access required")
    return current_user

@router.get("/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    """
    Get overall analytics overview — all computed in 4 DB round-trips.
    """
    thirty_days_ago = datetime.now() - timedelta(days=30)
    sixty_days_ago  = datetime.now() - timedelta(days=60)

    # ── Query 1: totals + status breakdown in a single pass ──────────────────
    row = db.query(
        func.sum(OrderTable.total_order_amount).label("total_revenue"),
        func.count(OrderTable.order_id).label("total_orders"),
        func.sum(case(
            (OrderTable.status == OrderStatus.CREATED,     1), else_=0
        )).label("cnt_created"),
        func.sum(case(
            (OrderTable.status == OrderStatus.IN_PROGRESS, 1), else_=0
        )).label("cnt_in_progress"),
        func.sum(case(
            (OrderTable.status == OrderStatus.COMPLETED,   1), else_=0
        )).label("cnt_completed"),
        # revenue slices for growth
        func.sum(case(
            (OrderTable.ordered_at >= thirty_days_ago,
             OrderTable.total_order_amount), else_=0
        )).label("rev_last_30"),
        func.sum(case(
            (
                (OrderTable.ordered_at >= sixty_days_ago) &
                (OrderTable.ordered_at <  thirty_days_ago),
                OrderTable.total_order_amount
            ), else_=0
        )).label("rev_prev_30"),
        # order-count slices for growth
        func.sum(case(
            (OrderTable.ordered_at >= thirty_days_ago, 1), else_=0
        )).label("ord_last_30"),
        func.sum(case(
            (
                (OrderTable.ordered_at >= sixty_days_ago) &
                (OrderTable.ordered_at <  thirty_days_ago),
                1
            ), else_=0
        )).label("ord_prev_30"),
    ).one()

    # ── Query 2: product count ────────────────────────────────────────────────
    total_products = db.query(func.count(Product.product_id)).scalar() or 0

    # ── Query 3: employee count ───────────────────────────────────────────────
    active_employees = db.query(func.count(UserTable.user_id))\
        .filter(UserTable.role == 'employee').scalar() or 0

    total_revenue  = float(row.total_revenue  or 0)
    rev_last_30    = float(row.rev_last_30    or 0)
    rev_prev_30    = float(row.rev_prev_30    or 0)
    ord_last_30    = int(row.ord_last_30      or 0)
    ord_prev_30    = int(row.ord_prev_30      or 0)

    revenue_growth = 0.0
    if rev_prev_30 > 0:
        revenue_growth = ((rev_last_30 - rev_prev_30) / rev_prev_30) * 100

    orders_growth = 0.0
    if ord_prev_30 > 0:
        orders_growth = ((ord_last_30 - ord_prev_30) / ord_prev_30) * 100

    return {
        "total_revenue":    str(total_revenue),
        "total_orders":     int(row.total_orders or 0),
        "total_products":   total_products,
        "active_employees": active_employees,
        "orders_by_status": {
            OrderStatus.CREATED.value:     int(row.cnt_created     or 0),
            OrderStatus.IN_PROGRESS.value: int(row.cnt_in_progress or 0),
            OrderStatus.COMPLETED.value:   int(row.cnt_completed   or 0),
        },
        "revenue_growth": round(revenue_growth, 2),
        "orders_growth":  round(orders_growth,  2),
    }

@router.get("/designers")
def get_designer_analytics(
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    """
    Get performance metrics for designers/admins — single aggregated query.
    """
    rows = db.query(
        UserTable.user_id,
        UserTable.user_username,
        func.count(OrderTable.order_id).label("order_count"),
        func.coalesce(func.sum(OrderTable.total_order_amount), 0).label("total_revenue"),
    ).outerjoin(
        OrderTable, OrderTable.user_id == UserTable.user_id
    ).filter(
        UserTable.role == 'admin'
    ).group_by(
        UserTable.user_id, UserTable.user_username
    ).order_by(
        desc("total_revenue")
    ).all()

    return [
        {
            "user_id":         r.user_id,
            "username":        r.user_username,
            "orders":          int(r.order_count),
            "revenue":         str(r.total_revenue),
            "avg_order_value": str(round(float(r.total_revenue) / r.order_count, 2)
                                   if r.order_count else "0"),
        }
        for r in rows
    ]

@router.get("/products/top")
def get_top_products(
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
    limit: int = 10
):
    """
    Get top selling products by quantity sold and revenue
    """
    # Query products with their sales data
    product_sales = db.query(
        Product.product_id,
        Product.item_name,
        func.sum(OrderedProducts.quantity).label('total_sold'),
        func.sum(OrderedProducts.total_price).label('total_revenue')
    ).join(
        OrderedProducts, Product.product_id == OrderedProducts.product_id
    ).group_by(
        Product.product_id, Product.item_name
    ).order_by(
        desc('total_revenue')
    ).limit(limit).all()
    
    top_products = []
    for product in product_sales:
        top_products.append({
            "product_id": product.product_id,
            "name": product.item_name,
            "sold": int(product.total_sold or 0),
            "revenue": str(product.total_revenue or 0)
        })
    
    return top_products

@router.get("/revenue-trend")
def get_revenue_trend(
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
    days: int = 30
):
    """
    Get daily revenue trend for the last N days
    """
    from datetime import date
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Get orders grouped by date
    daily_revenue = db.query(
        func.date(OrderTable.ordered_at).label('date'),
        func.sum(OrderTable.total_order_amount).label('revenue')
    ).filter(
        OrderTable.ordered_at >= start_date
    ).group_by(
        func.date(OrderTable.ordered_at)
    ).order_by(
        'date'
    ).all()
    
    # Create a complete date range with all days (filling gaps with 0)
    revenue_data = []
    current_date = start_date.date()
    revenue_dict = {row.date: float(row.revenue) for row in daily_revenue}
    
    while current_date <= end_date.date():
        revenue_data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "revenue": revenue_dict.get(current_date, 0)
        })
        current_date += timedelta(days=1)
    
    return revenue_data

@router.get("/orders-trend")
def get_orders_trend(
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
    days: int = 30
):
    """
    Get daily order count trend for the last N days
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Get orders grouped by date
    daily_orders = db.query(
        func.date(OrderTable.ordered_at).label('date'),
        func.count(OrderTable.order_id).label('orders')
    ).filter(
        OrderTable.ordered_at >= start_date
    ).group_by(
        func.date(OrderTable.ordered_at)
    ).order_by(
        'date'
    ).all()
    
    # Create a complete date range with all days (filling gaps with 0)
    orders_data = []
    current_date = start_date.date()
    orders_dict = {row.date: int(row.orders) for row in daily_orders}
    
    while current_date <= end_date.date():
        orders_data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "orders": orders_dict.get(current_date, 0)
        })
        current_date += timedelta(days=1)
    
    return orders_data

@router.get("/nursery/{nursery_id}/overview")
def get_nursery_overview(
    nursery_id: str,
    db: Session = Depends(get_db),
    current_user: UserTable = Depends(get_current_user),
):
    _require_nursery_or_admin(current_user)

    nursery = db.query(Nursery).filter(Nursery.nursery_id == nursery_id).first()
    if not nursery:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Nursery not found")

    summary = db.query(
        func.count(Product.product_id).label("products_count"),
        func.coalesce(func.sum(Product.inventory_quantity), 0).label("total_inventory"),
        func.coalesce(func.sum(Product.ordered_quantity), 0).label("total_ordered_quantity"),
    ).filter(
        Product.nursery_id == nursery_id
    ).one()

    top_products = db.query(
        Product.product_id,
        Product.item_name,
        Product.inventory_quantity,
        Product.ordered_quantity,
    ).filter(
        Product.nursery_id == nursery_id
    ).order_by(
        desc(Product.ordered_quantity),
        Product.item_name.asc(),
    ).limit(10).all()

    return {
        "nursery_id": nursery.nursery_id,
        "nursery_name": nursery.nursery_name,
        "products_count": int(summary.products_count or 0),
        "total_inventory": int(summary.total_inventory or 0),
        "total_ordered_quantity": int(summary.total_ordered_quantity or 0),
        "top_products": [
            {
                "product_id": row.product_id,
                "item_name": row.item_name,
                "inventory_quantity": int(row.inventory_quantity or 0),
                "ordered_quantity": int(row.ordered_quantity or 0),
            }
            for row in top_products
        ],
    }
