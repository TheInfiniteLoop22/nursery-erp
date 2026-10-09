from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import CORS_ORIGINS
from app.core.migrations import upgrade_to_head
from app.core.schema_sync import seed_default_zones
import app.models  # required

app = FastAPI(title="Nursery ERP API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Apply pending Alembic migrations, then make sure the default zones exist."""
    upgrade_to_head()
    seed_default_zones()

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health() -> dict[str, str]:
    """Liveness probe for Render and Docker; deliberately does not touch the database."""
    return {"status": "ok"}
