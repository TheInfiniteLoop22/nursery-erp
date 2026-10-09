import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None


def load_project_env() -> Path | None:
    """Load environment variables from a selected env file in project root.

    Priority:
    1) ENV_FILE explicit override
    2) APP_ENV=development -> .env.dev
    3) default -> .env
    """
    if load_dotenv is None:
        return None

    project_root = Path(__file__).resolve().parent.parent.parent
    env_file = os.getenv("ENV_FILE")

    if env_file:
        env_path = Path(env_file)
        if not env_path.is_absolute():
            env_path = project_root / env_file
    else:
        app_env = os.getenv("APP_ENV", "production").lower()
        env_path = project_root / ".env.dev" if app_env == "development" else project_root / ".env"

    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        return env_path

    return None
