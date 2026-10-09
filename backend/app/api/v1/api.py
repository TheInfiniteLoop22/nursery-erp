from fastapi import APIRouter

from app.api.v1.routes.auth_routes import router as auth_router
from app.api.v1.routes.product_routes import router as product_router
from app.api.v1.routes.order_routes import router as order_router
from app.api.v1.routes.product_note_routes import router as product_note_router
from app.api.v1.routes.nursery_routes import router as nursery_router
from app.api.v1.routes.order_status_routes import router as order_status_router
from app.api.v1.routes.analytics_routes import router as analytics_router
from app.api.v1.routes.employee_routes import router as employee_router
from app.api.v1.routes.notification_routes import router as notification_router
from app.api.v1.routes.event_routes import router as event_router
from app.api.v1.routes.scan_routes import router as scan_router
from app.api.v1.routes.zone_routes import router as zone_router
from app.api.v1.routes.planning_routes import router as planning_router
from app.api.v1.routes.stream_routes import router as stream_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])

api_router.include_router(product_router, prefix="/products", tags=["Products"])
api_router.include_router(product_note_router, tags=["Product Notes"])

api_router.include_router(order_router, prefix="/orders", tags=["Orders"])

api_router.include_router(order_status_router, prefix="/orders", tags=["Order Status"])

api_router.include_router(nursery_router, prefix="/nursery", tags=["Nursery"])

api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])

api_router.include_router(employee_router, prefix="/employees", tags=["Employees"])
api_router.include_router(zone_router, prefix="/zones", tags=["Zones"])
api_router.include_router(planning_router, prefix="/planning", tags=["Planning"])

api_router.include_router(notification_router, prefix="/notifications", tags=["Notifications"])

api_router.include_router(event_router, prefix="/events", tags=["Events"])

api_router.include_router(scan_router, prefix="/employees", tags=["Scan"])

api_router.include_router(stream_router, prefix="/stream", tags=["Live Stream"])
