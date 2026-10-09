import os
from app.core.env_loader import load_project_env

load_project_env()


def _parse_cors_origins(origins: str | None) -> list[str]:
    if not origins:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3030",
            "http://127.0.0.1:3030",
        ]
    return [origin.strip() for origin in origins.split(",") if origin.strip()]

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-this")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
CORS_ORIGINS = _parse_cors_origins(os.getenv("CORS_ORIGINS"))

#testcommit