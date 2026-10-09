from urllib.parse import quote_plus
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.env_loader import load_project_env

load_project_env()


def _resolve_database_url() -> str | None:
    raw = os.getenv("DATABASE_URL")
    if raw and raw.strip():
        return raw.strip()

    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    db = os.getenv("POSTGRES_DB")
    if not (user and password and db):
        return None

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    return (
        f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{db}"
    )


DATABASE_URL = _resolve_database_url()

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is not set. "
        "Set DATABASE_URL, or set POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB "
        "(and optionally POSTGRES_HOST, POSTGRES_PORT). "
        "For local dev, use .env (production) or .env.dev with APP_ENV=development, "
        "or set ENV_FILE to point to another env file."
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    connect_args={
        "connect_timeout": 10,
        "options": "-c client_encoding=utf8",
    },
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
