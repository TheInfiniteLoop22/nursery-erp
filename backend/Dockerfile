FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so this layer is cached between code changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and drop root privileges
COPY . .
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

# Render injects PORT; local Docker defaults to 8000.
ENV PORT=8000
EXPOSE 8000

# Single worker on purpose: live scan updates use an in-process event bus
# (app/services/event_bus.py). Scale out by swapping it for Postgres LISTEN/NOTIFY.
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-1}"]
